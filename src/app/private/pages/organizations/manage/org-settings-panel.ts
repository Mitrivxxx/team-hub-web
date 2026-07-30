import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import { MeMembership, Organization } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-org-settings-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './org-settings-panel.html',
  styleUrl: './org-settings-panel.scss',
})
export class OrgSettingsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly organizationUpdated = output<Organization>();

  readonly isSaving = signal(false);
  readonly isLeaving = signal(false);
  readonly isDeleting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = this.successFlash.message;
  readonly avatarError = signal<string | null>(null);

  readonly canManage = () => this.me().permissions.includes('org.manage');
  readonly canDelete = () => this.me().permissions.includes('org.delete');

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      const org = this.organization();
      this.form.patchValue({
        name: org.name,
        description: org.description ?? '',
      });
    });
  }

  save(): void {
    if (!this.canManage() || this.isSaving()) {
      return;
    }

    this.error.set(null);
    this.successFlash.clear();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description } = this.form.getRawValue();
    this.isSaving.set(true);

    this.organizationService
      .update(this.organization().id, {
        name: name.trim(),
        description: description.trim() || null,
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.organizationUpdated.emit(updated);
          this.successFlash.show('Organization settings saved.');
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to update organization.')),
      });
  }

  onAvatarSelected(event: Event): void {
    if (!this.canManage()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.avatarError.set(null);

    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      this.avatarError.set('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      this.avatarError.set('Image must be 2 MB or smaller.');
      return;
    }

    this.organizationService
      .uploadAvatar(this.organization().id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.organizationUpdated.emit(updated),
        error: (err) => this.avatarError.set(organizationApiErrorMessage(err, 'Failed to upload avatar.')),
      });
  }

  removeAvatar(): void {
    if (!this.canManage()) {
      return;
    }

    this.organizationService
      .deleteAvatar(this.organization().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => this.organizationUpdated.emit(updated),
        error: (err) => this.avatarError.set(organizationApiErrorMessage(err, 'Failed to remove avatar.')),
      });
  }

  leaveOrganization(): void {
    if (!confirm('Leave this organization?')) {
      return;
    }

    this.isLeaving.set(true);
    this.error.set(null);

    this.organizationService
      .leave(this.organization().id)
      .pipe(
        finalize(() => this.isLeaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/app']),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to leave organization.')),
      });
  }

  deleteOrganization(): void {
    if (!this.canDelete()) {
      return;
    }

    if (!confirm('Delete this organization permanently? This cannot be undone.')) {
      return;
    }

    this.isDeleting.set(true);
    this.error.set(null);

    this.organizationService
      .delete(this.organization().id)
      .pipe(
        finalize(() => this.isDeleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/app']),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to delete organization.')),
      });
  }
}
