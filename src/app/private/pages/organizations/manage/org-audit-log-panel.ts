import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { OrganizationGraphqlService } from '../../../../core/organizations/organization-graphql.service';
import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  ActivityUser,
  MeMembership,
  Organization,
  OrganizationActivityItem,
} from '../../../../core/organizations/organization.model';
import { TablePagination } from '../../../../shared/table-pagination/table-pagination';

const PAGE_SIZE = 20;

const AUDIT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'MemberJoined', label: 'Member joined' },
  { value: 'MemberLeft', label: 'Member left' },
  { value: 'MemberRolesChanged', label: 'Member roles changed' },
  { value: 'InvitationSent', label: 'Invitation sent' },
  { value: 'InvitationAccepted', label: 'Invitation accepted' },
  { value: 'InvitationRejected', label: 'Invitation rejected' },
  { value: 'InvitationExpired', label: 'Invitation expired' },
  { value: 'InvitationResent', label: 'Invitation resent' },
  { value: 'RoleCreated', label: 'Role created' },
  { value: 'RoleUpdated', label: 'Role updated' },
  { value: 'RoleDeleted', label: 'Role deleted' },
  { value: 'RolePermissionsChanged', label: 'Role permissions changed' },
  { value: 'RoleMemberAssigned', label: 'Role assigned' },
  { value: 'RoleMemberRevoked', label: 'Role revoked' },
  { value: 'PermissionCreated', label: 'Permission created' },
  { value: 'PermissionUpdated', label: 'Permission updated' },
  { value: 'PermissionDeleted', label: 'Permission deleted' },
  { value: 'TeamCreated', label: 'Team created' },
  { value: 'TeamUpdated', label: 'Team updated' },
  { value: 'TeamDeleted', label: 'Team deleted' },
  { value: 'TeamMemberAdded', label: 'Team member added' },
  { value: 'TeamMemberUpdated', label: 'Team member updated' },
  { value: 'TeamMemberRemoved', label: 'Team member removed' },
  { value: 'OrganizationUpdated', label: 'Organization updated' },
  { value: 'OwnershipTransferred', label: 'Ownership transferred' },
  { value: 'OrganizationDeleted', label: 'Organization deleted' },
];

@Component({
  selector: 'app-org-audit-log-panel',
  imports: [DatePipe, FormsModule, TablePagination],
  templateUrl: './org-audit-log-panel.html',
  styleUrl: './org-audit-log-panel.scss',
})
export class OrgAuditLogPanel {
  private readonly organizationGraphqlService = inject(OrganizationGraphqlService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly items = signal<OrganizationActivityItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly typeFilter = signal('');
  readonly currentPage = signal(1);
  readonly totalCount = signal(0);
  readonly pageSize = signal(PAGE_SIZE);

  readonly typeOptions = AUDIT_TYPE_OPTIONS;

  readonly totalPages = computed(() => {
    const size = this.pageSize();
    const total = this.totalCount();
    if (size <= 0 || total <= 0) {
      return 0;
    }
    return Math.ceil(total / size);
  });

  constructor() {
    let debounceHandle: ReturnType<typeof setTimeout> | null = null;

    effect(() => {
      const organizationId = this.organization().id;
      const type = this.typeFilter();
      const q = this.searchQuery();
      const page = this.currentPage();

      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }

      debounceHandle = setTimeout(() => {
        this.load(organizationId, type, q, page);
      }, 250);
    });

    this.destroyRef.onDestroy(() => {
      if (debounceHandle) {
        clearTimeout(debounceHandle);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onTypeChange(value: string): void {
    this.typeFilter.set(value);
    this.currentPage.set(1);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  typeLabel(type: string): string {
    return AUDIT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
  }

  displayUser(user: ActivityUser | null | undefined, fallbackId: string | null): string {
    if (user) {
      const fullName = `${user.name} ${user.surname}`.trim();
      return fullName || user.username || fallbackId || '—';
    }
    return fallbackId ? fallbackId.slice(0, 8) : '—';
  }

  detailsSummary(item: OrganizationActivityItem): string {
    if (!item.details) {
      return '—';
    }

    try {
      const parsed = JSON.parse(item.details) as Record<string, unknown>;
      if (Array.isArray(parsed['fromRoles']) && Array.isArray(parsed['toRoles'])) {
        return `${(parsed['fromRoles'] as string[]).join(', ') || '—'} → ${(parsed['toRoles'] as string[]).join(', ') || '—'}`;
      }
      if (typeof parsed['email'] === 'string') {
        const roles = Array.isArray(parsed['roles']) ? (parsed['roles'] as string[]).join(', ') : '';
        return roles ? `${parsed['email']} (${roles})` : parsed['email'];
      }
      if (typeof parsed['teamName'] === 'string') {
        const roleName = typeof parsed['roleName'] === 'string' ? parsed['roleName'] : '';
        return roleName ? `${parsed['teamName']} · ${roleName}` : parsed['teamName'];
      }
      if (typeof parsed['roleName'] === 'string') {
        return parsed['roleName'];
      }
      if (typeof parsed['name'] === 'string') {
        return parsed['name'];
      }
      if (typeof parsed['code'] === 'string') {
        return parsed['code'];
      }
      if (Array.isArray(parsed['permissionCodes'])) {
        const changeType = typeof parsed['changeType'] === 'string' ? `${parsed['changeType']}: ` : '';
        return `${changeType}${(parsed['permissionCodes'] as string[]).join(', ')}`;
      }
      if (Array.isArray(parsed['roles'])) {
        return (parsed['roles'] as string[]).join(', ');
      }
      return item.details;
    } catch {
      return item.details;
    }
  }

  private load(organizationId: string, type: string, q: string, page: number): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationGraphqlService
      .listActivity(organizationId, {
        type: type || undefined,
        q: q.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.totalCount.set(result.totalCount);
          this.pageSize.set(result.pageSize);
          if (result.page !== this.currentPage()) {
            this.currentPage.set(result.page);
          }
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load audit log.'));
          this.items.set([]);
          this.totalCount.set(0);
        },
      });
  }
}
