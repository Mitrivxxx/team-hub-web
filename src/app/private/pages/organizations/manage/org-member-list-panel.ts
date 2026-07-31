import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { OrganizationGraphqlService } from '../../../../core/organizations/organization-graphql.service';
import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  MeMembership,
  Member,
  Organization,
  RoleListItem,
  TeamMembership,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';
import { OverflowMenu } from '../../../../shared/overflow-menu/overflow-menu';
import { OverflowMenuItem } from '../../../../shared/overflow-menu/overflow-menu.model';
import { TablePagination } from '../../../../shared/table-pagination/table-pagination';
import { AddMemberModal } from './add-member-modal/add-member-modal';

type SortColumn = 'name' | 'surname' | 'joined';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-org-member-list-panel',
  imports: [DatePipe, FormsModule, OverflowMenu, TablePagination, AddMemberModal],
  templateUrl: './org-member-list-panel.html',
  styleUrl: './org-member-list-panel.scss',
})
export class OrgMemberListPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly organizationGraphqlService = inject(OrganizationGraphqlService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();
  readonly addMemberRequest = input(0);

  readonly members = signal<Member[]>([]);
  readonly orgRoles = signal<RoleListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = this.successFlash.message;
  readonly busyUserId = signal<string | null>(null);
  readonly showAddMemberModal = signal(false);

  readonly searchQuery = signal('');
  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>('asc');
  readonly currentPage = signal(1);

  readonly roleDrafts = signal<Record<string, string>>({});

  readonly detailsUserId = signal<string | null>(null);
  readonly detailsMember = signal<Member | null>(null);
  readonly detailsTeams = signal<TeamMembership[]>([]);
  readonly detailsLoading = signal(false);
  readonly detailsError = signal<string | null>(null);
  readonly editingRoleInDetails = signal(false);

  readonly canManage = () => this.me().permissions.includes('org.members.manage');

  readonly filteredMembers = computed(() => {
    const search = this.searchQuery().trim().toLowerCase();

    let result = this.members().filter((member) => {
      const name = member.user?.name?.toLowerCase() ?? '';
      const surname = member.user?.surname?.toLowerCase() ?? '';
      const username = member.user?.username?.toLowerCase() ?? '';

      if (search && !`${name} ${surname} ${username}`.includes(search)) {
        return false;
      }
      return true;
    });

    const column = this.sortColumn();
    const direction = this.sortDirection();
    if (column) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        if (column === 'name') {
          comparison = (a.user?.name ?? '').localeCompare(b.user?.name ?? '', undefined, {
            sensitivity: 'base',
          });
        } else if (column === 'surname') {
          comparison = (a.user?.surname ?? '').localeCompare(b.user?.surname ?? '', undefined, {
            sensitivity: 'base',
          });
        } else if (column === 'joined') {
          comparison = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        }
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  });

  readonly totalPages = computed(() => {
    const total = this.filteredMembers().length;
    return total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  });

  readonly pagedMembers = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredMembers().slice(start, start + PAGE_SIZE);
  });

  readonly memberUserIds = computed(() => this.members().map((m) => m.userId));

  /** Baseline so remounting the panel (tab switch) does not re-open the modal. */
  private lastSeenAddMemberRequest: number | null = null;

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.loadRoles(org.id);
        this.load(org.id);
      }
    });

    effect(() => {
      const request = this.addMemberRequest();
      const previous = this.lastSeenAddMemberRequest;
      this.lastSeenAddMemberRequest = request;
      if (previous !== null && request > previous && this.canManage()) {
        this.showAddMemberModal.set(true);
      }
    });

    effect(() => {
      this.searchQuery();
      this.sortColumn();
      this.sortDirection();
      this.members();
      this.currentPage.set(1);
    });
  }

  displayName(member: Member): string {
    const name = member.user?.name?.trim() ?? '';
    const surname = member.user?.surname?.trim() ?? '';
    const full = `${name} ${surname}`.trim();
    return full || member.user?.username || 'Unknown user';
  }

  roleNames(member: Member): string {
    return member.roles.map((r) => r.name).join(', ') || '—';
  }

  primaryRoleId(member: Member): string {
    return member.roles[0]?.id ?? '';
  }

  sortIndicator(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return '';
    }
    return this.sortDirection() === 'asc' ? ' ↑' : ' ↓';
  }

  toggleSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  menuItems(member: Member): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [{ id: 'details', label: 'Details' }];
    if (this.canManage()) {
      items.push({ id: 'edit-role', label: 'Edit role' });
      items.push({
        id: 'remove',
        label: 'Remove',
        danger: true,
        disabled: member.userId === this.me().userId,
      });
    }
    return items;
  }

  onMenuAction(member: Member, actionId: string): void {
    if (actionId === 'details') {
      this.openDetails(member);
      return;
    }
    if (actionId === 'edit-role') {
      this.openDetails(member, true);
      return;
    }
    if (actionId === 'remove') {
      this.removeMember(member);
    }
  }

  closeAddMemberModal(): void {
    this.showAddMemberModal.set(false);
  }

  onMemberAdded(): void {
    this.showAddMemberModal.set(false);
    this.successFlash.show('Member added.');
    this.load(this.organization().id);
  }

  onRoleDraftChange(userId: string, roleId: string): void {
    this.roleDrafts.update((drafts) => ({ ...drafts, [userId]: roleId }));
  }

  applyRole(member: Member): void {
    if (!this.canManage()) {
      return;
    }

    const roleId = (this.roleDrafts()[member.userId] ?? this.primaryRoleId(member)).trim();
    const currentIds = member.roles.map((r) => r.id).sort().join(',');
    if (!roleId || currentIds === roleId) {
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();
    this.busyUserId.set(member.userId);

    this.organizationService
      .updateMember(this.organization().id, member.userId, { roleIds: [roleId] })
      .pipe(
        finalize(() => this.busyUserId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.members.update((items) => items.map((m) => (m.userId === updated.userId ? updated : m)));
          this.roleDrafts.update((drafts) => ({
            ...drafts,
            [updated.userId]: updated.roles[0]?.id ?? '',
          }));
          if (this.detailsMember()?.userId === updated.userId) {
            this.detailsMember.set({ ...updated, user: member.user ?? updated.user });
          }
          this.editingRoleInDetails.set(false);
          this.successFlash.show('Roles updated.');
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to update member role.')),
      });
  }

  removeMember(member: Member): void {
    if (!this.canManage()) {
      return;
    }

    if (!confirm(`Remove member ${this.displayName(member)}?`)) {
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();
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
          this.successFlash.show('Member removed.');
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to remove member.')),
      });
  }

  openDetails(member: Member, editRole = false): void {
    if (this.detailsUserId() === member.userId) {
      if (editRole) {
        this.editingRoleInDetails.set(true);
      }
      return;
    }

    this.detailsUserId.set(member.userId);
    this.detailsMember.set(null);
    this.detailsTeams.set([]);
    this.detailsError.set(null);
    this.detailsLoading.set(true);
    this.editingRoleInDetails.set(editRole);

    const orgId = this.organization();
    forkJoin({
      member: this.organizationService.getMember(orgId.id, member.userId),
      teams: this.organizationService.listMemberTeams(orgId.id, member.userId),
    })
      .pipe(
        finalize(() => this.detailsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ member: detail, teams }) => {
          const merged = { ...detail, user: member.user ?? detail.user };
          this.detailsMember.set(merged);
          this.detailsTeams.set(teams);
          this.roleDrafts.update((drafts) => ({
            ...drafts,
            [merged.userId]: merged.roles[0]?.id ?? '',
          }));
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
    this.editingRoleInDetails.set(false);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  private loadRoles(organizationId: string): void {
    this.organizationService
      .listRoles(organizationId, 'ORG')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => this.orgRoles.set(roles),
        error: () => this.orgRoles.set([]),
      });
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationGraphqlService
      .listMembers(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.roleDrafts.set(
            Object.fromEntries(members.map((m) => [m.userId, m.roles[0]?.id ?? ''])),
          );
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load members.'));
          this.isLoading.set(false);
        },
      });
  }
}
