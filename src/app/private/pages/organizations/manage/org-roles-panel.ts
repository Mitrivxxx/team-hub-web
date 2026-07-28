import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  MeMembership,
  Organization,
  PermissionListItem,
  RoleDetail,
  RoleListItem,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

type RolesSection = 'create' | 'organization' | 'team';

@Component({
  selector: 'app-org-roles-panel',
  imports: [FormsModule],
  templateUrl: './org-roles-panel.html',
  styleUrl: './org-roles-panel.scss',
})
export class OrgRolesPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly orgRoles = signal<RoleListItem[]>([]);
  readonly teamRoles = signal<RoleListItem[]>([]);
  readonly permissions = signal<PermissionListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly isCreating = signal(false);
  readonly activeSection = signal<RolesSection>('organization');

  readonly createName = signal('');
  readonly createDescription = signal('');
  readonly createScope = signal<'ORG' | 'TEAM'>('ORG');

  readonly selectedRoleId = signal<string | null>(null);
  readonly selectedRole = signal<RoleDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly permissionDraftIds = signal<string[]>([]);

  readonly canManage = () => this.me().permissions.includes('org.roles.manage');

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  selectSection(section: RolesSection): void {
    if (this.activeSection() === section) {
      return;
    }

    this.activeSection.set(section);
    this.closeRole();
    this.actionError.set(null);
    this.actionSuccess.set(null);
  }

  createRole(): void {
    if (!this.canManage()) {
      return;
    }

    const name = this.createName().trim();
    if (!name) {
      this.actionError.set('Role name is required.');
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);
    this.isCreating.set(true);

    const scope = this.createScope();

    this.organizationService
      .createRole(this.organization().id, {
        name,
        description: this.createDescription().trim() || undefined,
        scope,
      })
      .pipe(
        finalize(() => this.isCreating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.createName.set('');
          this.createDescription.set('');
          this.actionSuccess.set('Role created.');
          this.activeSection.set(scope === 'TEAM' ? 'team' : 'organization');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to create role.')),
      });
  }

  openRole(role: RoleListItem): void {
    if (this.selectedRoleId() === role.id) {
      this.closeRole();
      return;
    }

    this.selectedRoleId.set(role.id);
    this.selectedRole.set(null);
    this.detailLoading.set(true);

    this.organizationService
      .getRole(this.organization().id, role.id)
      .pipe(
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.selectedRole.set(detail);
          this.permissionDraftIds.set(detail.permissions.map((p) => p.id));
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to load role.')),
      });
  }

  closeRole(): void {
    this.selectedRoleId.set(null);
    this.selectedRole.set(null);
    this.permissionDraftIds.set([]);
  }

  togglePermissionDraft(permissionId: string, checked: boolean): void {
    this.permissionDraftIds.update((ids) => {
      if (checked) {
        return ids.includes(permissionId) ? ids : [...ids, permissionId];
      }
      return ids.filter((id) => id !== permissionId);
    });
  }

  isPermissionSelected(permissionId: string): boolean {
    return this.permissionDraftIds().includes(permissionId);
  }

  saveRolePermissions(): void {
    const role = this.selectedRole();
    if (!role || !this.canManage() || role.name === 'Owner') {
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);

    this.organizationService
      .replaceRolePermissions(this.organization().id, role.id, {
        permissionIds: this.permissionDraftIds(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (permissions) => {
          this.selectedRole.update((current) =>
            current
              ? {
                  ...current,
                  permissions,
                  memberCount: current.memberCount,
                }
              : current,
          );
          this.actionSuccess.set('Role permissions updated.');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to update permissions.')),
      });
  }

  deleteRole(role: RoleListItem): void {
    if (!this.canManage() || role.isSystem) {
      return;
    }

    if (!confirm(`Delete role "${role.name}"?`)) {
      return;
    }

    this.organizationService
      .deleteRole(this.organization().id, role.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.selectedRoleId() === role.id) {
            this.closeRole();
          }
          this.actionSuccess.set('Role deleted.');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to delete role.')),
      });
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    forkJoin({
      orgRoles: this.organizationService.listRoles(organizationId, 'ORG'),
      teamRoles: this.organizationService.listRoles(organizationId, 'TEAM'),
      permissions: this.organizationService.listPermissions(organizationId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ orgRoles, teamRoles, permissions }) => {
          this.orgRoles.set(orgRoles);
          this.teamRoles.set(teamRoles);
          this.permissions.set(permissions);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load roles.'));
          this.isLoading.set(false);
        },
      });
  }
}
