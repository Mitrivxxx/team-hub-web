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

@Component({
  selector: 'app-org-permissions-panel',
  imports: [DatePipe, FormsModule],
  templateUrl: './org-permissions-panel.html',
  styleUrl: './org-permissions-panel.scss',
})
export class OrgPermissionsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly permissions = signal<PermissionListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly isCreating = signal(false);

  readonly createName = signal('');
  readonly createCode = signal('');
  readonly createDescription = signal('');

  readonly selectedId = signal<string | null>(null);
  readonly selected = signal<PermissionDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly canManage = () => this.me().permissions.includes('org.roles.manage');

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  createPermission(): void {
    if (!this.canManage()) {
      return;
    }

    const name = this.createName().trim();
    const code = this.createCode().trim();
    if (!name || !code) {
      this.actionError.set('Name and code are required.');
      return;
    }

    this.actionError.set(null);
    this.actionSuccess.set(null);
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
          this.actionSuccess.set('Permission created.');
          this.load(this.organization().id);
        },
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to create permission.')),
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
        next: (detail) => this.selected.set(detail),
        error: (err) => this.actionError.set(organizationApiErrorMessage(err, 'Failed to load permission.')),
      });
  }

  closePermission(): void {
    this.selectedId.set(null);
    this.selected.set(null);
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
          this.actionSuccess.set('Permission deleted.');
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
