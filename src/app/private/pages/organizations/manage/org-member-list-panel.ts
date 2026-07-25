import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  MeMembership,
  Member,
  Organization,
  TeamMembership,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

@Component({
  selector: 'app-org-member-list-panel',
  imports: [DatePipe, FormsModule],
  templateUrl: './org-member-list-panel.html',
  styleUrl: './org-member-list-panel.scss',
})
export class OrgMemberListPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly members = signal<Member[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly busyUserId = signal<string | null>(null);
  readonly isAdding = signal(false);

  readonly filterRoleId = signal('');
  readonly filterTeamId = signal('');

  readonly addUserId = signal('');
  readonly addRoleId = signal('');

  readonly roleDrafts = signal<Record<string, string>>({});

  readonly detailsUserId = signal<string | null>(null);
  readonly detailsMember = signal<Member | null>(null);
  readonly detailsTeams = signal<TeamMembership[]>([]);
  readonly detailsLoading = signal(false);
  readonly detailsError = signal<string | null>(null);

  readonly canManage = () => this.me().permissions.includes('org.members.manage');

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  applyFilters(): void {
    this.load(this.organization().id);
  }

  clearFilters(): void {
    this.filterRoleId.set('');
    this.filterTeamId.set('');
    this.load(this.organization().id, { roleId: '', teamId: '' });
  }

  addMember(): void {
    if (!this.canManage()) {
      return;
    }

    const userId = this.addUserId().trim();
    const roleId = this.addRoleId().trim();
    if (!userId || !roleId) {
      this.actionError.set('User ID and Role ID are required.');
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.isAdding.set(true);

    this.organizationService
      .addMember(this.organization().id, { userId, roleId })
      .pipe(
        finalize(() => this.isAdding.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.addUserId.set('');
          this.addRoleId.set('');
          this.actionSuccess.set('Member added.');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to add member.')),
      });
  }

  onRoleDraftChange(userId: string, roleId: string): void {
    this.roleDrafts.update((drafts) => ({ ...drafts, [userId]: roleId }));
  }

  applyRole(member: Member): void {
    if (!this.canManage()) {
      return;
    }

    const roleId = (this.roleDrafts()[member.userId] ?? member.roleId).trim();
    if (!roleId || roleId === member.roleId) {
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.busyUserId.set(member.userId);

    this.organizationService
      .updateMember(this.organization().id, member.userId, { roleId })
      .pipe(
        finalize(() => this.busyUserId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.members.update((items) => items.map((m) => (m.userId === updated.userId ? updated : m)));
          this.roleDrafts.update((drafts) => ({ ...drafts, [updated.userId]: updated.roleId }));
          this.actionSuccess.set('Role updated.');
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to update member role.')),
      });
  }

  removeMember(member: Member): void {
    if (!this.canManage()) {
      return;
    }

    if (!confirm(`Remove member ${member.userId}?`)) {
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.busyUserId.set(member.userId);

    this.organizationService
      .removeMember(this.organization().id, member.userId)
      .pipe(
        finalize(() => this.busyUserId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.members.update((items) => items.filter((m) => m.userId !== member.userId));
          if (this.detailsUserId() === member.userId) {
            this.closeDetails();
          }
          this.actionSuccess.set('Member removed.');
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to remove member.')),
      });
  }

  toggleDetails(member: Member): void {
    if (this.detailsUserId() === member.userId) {
      this.closeDetails();
      return;
    }

    this.detailsUserId.set(member.userId);
    this.detailsMember.set(null);
    this.detailsTeams.set([]);
    this.detailsError.set(null);
    this.detailsLoading.set(true);

    const orgId = this.organization().id;
    forkJoin({
      member: this.organizationService.getMember(orgId, member.userId),
      teams: this.organizationService.listMemberTeams(orgId, member.userId),
    })
      .pipe(
        finalize(() => this.detailsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ member: detail, teams }) => {
          this.detailsMember.set(detail);
          this.detailsTeams.set(teams);
        },
        error: (err) => this.detailsError.set(organizationApiErrorMessage(err, 'Failed to load member details.')),
      });
  }

  closeDetails(): void {
    this.detailsUserId.set(null);
    this.detailsMember.set(null);
    this.detailsTeams.set([]);
    this.detailsError.set(null);
    this.detailsLoading.set(false);
  }

  private load(
    organizationId: string,
    override?: { roleId?: string; teamId?: string },
  ): void {
    this.isLoading.set(true);
    this.error.set(null);

    const roleId = (override?.roleId ?? this.filterRoleId()).trim() || undefined;
    const teamId = (override?.teamId ?? this.filterTeamId()).trim() || undefined;

    this.organizationService
      .listMembers(organizationId, { roleId, teamId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.roleDrafts.set(Object.fromEntries(members.map((m) => [m.userId, m.roleId])));
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load members.'));
          this.isLoading.set(false);
        },
      });
  }
}
