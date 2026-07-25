import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import { Invitation, MeMembership, Organization, Role } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

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

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly invitationCreated = output<void>();

  readonly orgRoles = signal<Role[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly canManage = () => this.me().permissions.includes('org.members.manage');

  readonly inviteForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    orgRoleId: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  submitInvite(): void {
    if (!this.canManage() || this.isSubmitting()) {
      return;
    }

    this.error.set(null);
    this.success.set(null);

    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { email, orgRoleId } = this.inviteForm.getRawValue();

    this.organizationService
      .createInvitation(this.organization().id, { email: email.trim().toLowerCase(), orgRoleId })
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invitation) => {
          this.invitations.update((items) => [invitation, ...items]);
          this.inviteForm.reset({ email: '', orgRoleId: this.defaultRoleId() });
          this.success.set(`Invitation sent to ${invitation.email}.`);
          this.invitationCreated.emit();
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to create invitation.')),
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
}
