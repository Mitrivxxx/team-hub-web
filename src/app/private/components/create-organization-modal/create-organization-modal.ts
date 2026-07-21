import { Component, inject, OnDestroy, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { OrganizationService } from '../../../core/organizations/organization.service';
import { Organization } from '../../../core/organizations/organization.model';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-create-organization-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './create-organization-modal.html',
  styleUrl: './create-organization-modal.scss',
})
export class CreateOrganizationModal implements OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly organizationService = inject(OrganizationService);

  readonly closed = output<void>();
  readonly created = output<Organization>();

  isSubmitting = false;
  submitError: string | null = null;
  avatarError: string | null = null;
  selectedAvatar: File | null = null;
  avatarPreviewUrl: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  ngOnDestroy(): void {
    this.revokeAvatarPreview();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    if (this.isSubmitting) {
      return;
    }
    this.closed.emit();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    this.avatarError = null;

    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      this.avatarError = 'Only JPEG, PNG, or WebP images are allowed.';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      this.avatarError = 'Image must be 2 MB or smaller.';
      return;
    }

    this.revokeAvatarPreview();
    this.selectedAvatar = file;
    this.avatarPreviewUrl = URL.createObjectURL(file);
  }

  removeAvatar(): void {
    this.revokeAvatarPreview();
    this.selectedAvatar = null;
    this.avatarError = null;
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.submitError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const name = this.form.controls.name.value.trim();
    if (!name) {
      this.form.controls.name.setErrors({ required: true });
      this.form.controls.name.markAsTouched();
      return;
    }

    const description = this.form.controls.description.value.trim();

    this.isSubmitting = true;
    this.organizationService
      .createWithDetails({
        name,
        description: description || undefined,
        avatar: this.selectedAvatar ?? undefined,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (result) => {
          this.created.emit(result.organization);
        },
        error: (error: unknown) => {
          this.submitError = this.resolveErrorMessage(error);
        },
      });
  }

  private revokeAvatarPreview(): void {
    if (this.avatarPreviewUrl) {
      URL.revokeObjectURL(this.avatarPreviewUrl);
      this.avatarPreviewUrl = null;
    }
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) {
        const detail = (error.error as { detail?: string } | null)?.detail;
        return detail ?? 'Organization slug is already taken.';
      }
      if (error.status === 400) {
        const detail = (error.error as { detail?: string } | null)?.detail;
        return detail ?? 'Invalid organization data.';
      }
      if (error.status === 503) {
        return 'Image storage is not available. Try again without a photo.';
      }
    }

    return 'Failed to create organization. Please try again.';
  }
}
