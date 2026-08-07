import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  Invitation,
  MeMembership,
  Organization,
  RoleListItem,
  Team,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';

@Component({
  selector: 'app-org-add-member-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './org-add-member-panel.html',
  styleUrl: './org-add-member-panel.scss',
})
export class OrgAddMemberPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly invitationCreated = output<void>();

  readonly orgRoles = signal<RoleListItem[]>([]);
  readonly teamRoles = signal<RoleListItem[]>([]);
  readonly teams = signal<Team[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly lastInviteLink = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = this.successFlash.message;

  readonly canManage = () => this.me().permissions.includes('org.members.manage');

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    orgRoleId: ['', Validators.required],
    teamId: [''],
    teamRoleId: [''],
  });

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  onTeamChange(): void {
    const teamId = this.inviteForm.controls.teamId.value;
    if (!teamId) {
      this.inviteForm.patchValue({ teamRoleId: '' });
      return;
    }
    if (!this.inviteForm.controls.teamRoleId.value) {
      this.inviteForm.patchValue({ teamRoleId: this.defaultTeamRoleId() });
    }
  }

  roleNamesForInvitation(invitation: Invitation): string {
    const byId = new Map(this.orgRoles().map((r) => [r.id, r.name]));
    return invitation.orgRoleIds.map((id) => byId.get(id) ?? id).join(', ') || '—';
  }

  inviteLinkFor(invitation: Invitation): string | null {
    if (!invitation.token) {
      return null;
    }
    return `${window.location.origin}/app/invitations/accept?token=${encodeURIComponent(invitation.token)}`;
  }

  async copyLastInviteLink(): Promise<void> {
    const link = this.lastInviteLink();
    if (!link) {
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.successFlash.show('Invite link copied. No email delivery — share this link.');
    } catch {
      this.error.set('Failed to copy invite link.');
    }
  }

  async copyInviteLink(invitation: Invitation): Promise<void> {
    const link = this.inviteLinkFor(invitation) ?? this.lastInviteLink();
    if (!link) {
      this.error.set('No invite link available. Use Resend to get a fresh link.');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      this.successFlash.show('Invite link copied. No email delivery — share this link.');
    } catch {
      this.error.set('Failed to copy invite link.');
    }
  }

  submitInvite(): void {
    if (!this.canManage() || this.isSubmitting()) {
      return;
    }

    this.error.set(null);
    this.successFlash.clear();
    this.lastInviteLink.set(null);

    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const { email, orgRoleId, teamId, teamRoleId } = this.inviteForm.getRawValue();
    if (teamId && !teamRoleId) {
      this.error.set('Select a team role when inviting into a team.');
      return;
    }

    this.isSubmitting.set(true);

    this.organizationService
      .createInvitation(this.organization().id, {
        email: email.trim().toLowerCase(),
        orgRoleIds: [orgRoleId],
        teamId: teamId || undefined,
        teamRoleId: teamId ? teamRoleId || undefined : undefined,
      })
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invitation) => {
          this.invitations.update((items) => [invitation, ...items]);
          this.inviteForm.reset({
            email: '',
            orgRoleId: this.defaultRoleId(),
            teamId: '',
            teamRoleId: '',
          });
          const link = this.inviteLinkFor(invitation);
          this.lastInviteLink.set(link);
          this.successFlash.show(
            link
              ? `Invitation created for ${invitation.email}. Copy and share the link (no email delivery).`
              : `Invitation created for ${invitation.email}.`,
          );
          this.invitationCreated.emit();
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to create invitation.')),
      });
  }

  resendInvitation(invitation: Invitation): void {
    if (!this.canManage()) {
      return;
    }

    this.error.set(null);
    this.organizationService
      .resendInvitation(this.organization().id, invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.invitations.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          const link = this.inviteLinkFor(updated);
          this.lastInviteLink.set(link);
          this.successFlash.show('Invitation resent. Copy and share the new link (no email delivery).');
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to resend invitation.')),
      });
  }

  cancelInvitation(invitation: Invitation): void {
    if (!this.canManage()) {
      return;
    }

    this.organizationService
      .cancelInvitation(this.organization().id, invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.invitations.update((items) => items.filter((i) => i.id !== invitation.id)),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to cancel invitation.')),
      });
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationService
      .listRoles(organizationId, 'ORG')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.orgRoles.set(roles.filter((r) => r.name !== 'Owner'));
          const defaultRole = this.defaultRoleId();
          if (defaultRole) {
            this.inviteForm.patchValue({ orgRoleId: defaultRole });
          }
        },
        error: () => this.orgRoles.set([]),
      });

    this.organizationService
      .listRoles(organizationId, 'TEAM')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => this.teamRoles.set(roles),
        error: () => this.teamRoles.set([]),
      });

    this.organizationService
      .listTeams(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams) => this.teams.set(teams),
        error: () => this.teams.set([]),
      });

    if (this.canManage()) {
      this.organizationService
        .listInvitations(organizationId, 'Pending')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (invitations) => {
            this.invitations.set(invitations);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.error.set(organizationApiErrorMessage(err, 'Failed to load invitations.'));
            this.isLoading.set(false);
          },
        });
    } else {
      this.isLoading.set(false);
    }
  }

  private defaultRoleId(): string {
    return this.orgRoles().find((r) => r.name === 'Member')?.id ?? this.orgRoles()[0]?.id ?? '';
  }

  private defaultTeamRoleId(): string {
    return this.teamRoles().find((r) => r.name === 'Member')?.id ?? this.teamRoles()[0]?.id ?? '';
  }
}
