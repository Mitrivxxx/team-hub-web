import { DatePipe } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  MeMembership,
  Organization,
  PermissionDetail,
  PermissionListItem,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';

@Component({
  selector: 'app-org-permissions-panel',
  imports: [DatePipe, FormsModule],
  templateUrl: './org-permissions-panel.html',
  styleUrl: './org-permissions-panel.scss',
})
export class OrgPermissionsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly permissions = signal<PermissionListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = this.successFlash.message;

  readonly selectedId = signal<string | null>(null);
  readonly selected = signal<PermissionDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly createName = signal('');
  readonly createCode = signal('');
  readonly createDescription = signal('');
  readonly isCreating = signal(false);

  readonly editName = signal('');
  readonly editDescription = signal('');
  readonly isSaving = signal(false);

  readonly canManage = () => this.me().permissions.includes('org.roles.manage');

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  openPermission(permission: PermissionListItem): void {
    if (this.selectedId() === permission.id) {
      this.closePermission();
      return;
    }

    this.selectedId.set(permission.id);
    this.selected.set(null);
    this.detailLoading.set(true);

    this.organizationService
      .getPermission(this.organization().id, permission.id)
      .pipe(
        finalize(() => this.detailLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.selected.set(detail);
          this.editName.set(detail.name);
          this.editDescription.set(detail.description ?? '');
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to load permission.')),
      });
  }

  closePermission(): void {
    this.selectedId.set(null);
    this.selected.set(null);
    this.editName.set('');
    this.editDescription.set('');
  }

  createPermission(): void {
    if (!this.canManage() || this.isCreating()) {
      return;
    }

    const name = this.createName().trim();
    const code = this.createCode().trim();
    if (!name || !code) {
      this.actionError.set('Name and code are required.');
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();
    this.isCreating.set(true);

    this.organizationService
      .createPermission(this.organization().id, {
        name,
        code,
        description: this.createDescription().trim() || undefined,
      })
      .pipe(
        finalize(() => this.isCreating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.createName.set('');
          this.createCode.set('');
          this.createDescription.set('');
          this.successFlash.show('Permission created.');
          this.load(this.organization().id);
        },
        error: (err) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to create permission.')),
      });
  }

  savePermission(): void {
    const permission = this.selected();
    if (!permission || !this.canManage() || permission.isSystem || this.isSaving()) {
      return;
    }

    const name = this.editName().trim();
    if (!name) {
      this.actionError.set('Permission name is required.');
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();
    this.isSaving.set(true);

    this.organizationService
      .updatePermission(this.organization().id, permission.id, {
        name,
        description: this.editDescription().trim() || null,
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.selected.set(updated);
          this.editName.set(updated.name);
          this.editDescription.set(updated.description ?? '');
          this.successFlash.show('Permission updated.');
          this.load(this.organization().id);
        },
        error: (err) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to update permission.')),
      });
  }

  deletePermission(permission: PermissionListItem): void {
    if (!this.canManage() || permission.isSystem) {
      return;
    }

    if (!confirm(`Delete permission "${permission.code}"?`)) {
      return;
    }

    this.organizationService
      .deletePermission(this.organization().id, permission.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.selectedId() === permission.id) {
            this.closePermission();
          }
          this.successFlash.show('Permission deleted.');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to delete permission.')),
      });
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationService
      .listPermissions(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (permissions) => {
          this.permissions.set(permissions);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load permissions.'));
          this.isLoading.set(false);
        },
      });
  }
}
