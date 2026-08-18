import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, AuthValidationError, UserResponse } from '../../../core/auth/auth.service';
import { emailFormatValidator, humanNameValidator } from '../../../core/auth/register.validators';
import { createFlashMessage } from '../../../shared/flash-message';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const profileFieldToFormControl = {
  name: 'firstName',
  surname: 'lastName',
  email: 'email',
} as const;

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly avatarError = signal<string | null>(null);
  readonly isSavingProfile = signal(false);
  readonly isSavingPassword = signal(false);
  readonly isUploadingAvatar = signal(false);
  readonly success = this.successFlash.message;

  readonly user = computed(() => this.authService.currentUser());
  readonly initials = computed(() => {
    const user = this.user();
    if (!user) {
      return '?';
    }
    const first = user.name.trim().charAt(0);
    const last = user.surname.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || user.username.charAt(0).toUpperCase();
  });

  readonly profileForm = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, humanNameValidator(50)]],
    lastName: ['', [Validators.required, humanNameValidator(80)]],
    email: ['', [Validators.required, emailFormatValidator]],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  ngOnInit(): void {
    this.authService
      .getMe()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => this.patchProfile(user),
        error: () => this.loadError.set('Failed to load profile.'),
      });
  }

  saveProfile(): void {
    if (this.isSavingProfile()) {
      return;
    }

    this.profileError.set(null);
    this.clearServerErrors(this.profileForm);

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const { firstName, lastName, email } = this.profileForm.getRawValue();
    const previousEmail = this.user()?.email?.trim().toLowerCase() ?? '';
    const nextEmail = email.trim().toLowerCase();
    const emailChanged = previousEmail !== nextEmail;

    this.isSavingProfile.set(true);
    this.authService
      .updateMe({ name: firstName, surname: lastName, email })
      .pipe(
        finalize(() => this.isSavingProfile.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (user) => {
          if (emailChanged) {
            this.authService.clearLocalSession();
            void this.router.navigate(['/login']);
            return;
          }

          this.patchProfile(user);
          this.successFlash.show('Profile updated.');
        },
        error: (error: unknown) => {
          if (error instanceof AuthValidationError) {
            this.applyServerErrors(this.profileForm, error, profileFieldToFormControl);
            return;
          }

          this.profileError.set('Failed to update profile.');
        },
      });
  }

  savePassword(): void {
    if (this.isSavingPassword()) {
      return;
    }

    this.passwordError.set(null);

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.isSavingPassword.set(true);
    this.authService
      .changeMyPassword(currentPassword, newPassword)
      .pipe(
        finalize(() => this.isSavingPassword.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.authService.clearLocalSession();
          void this.router.navigate(['/login']);
        },
        error: (error: unknown) => {
          if (error instanceof AuthValidationError) {
            this.passwordError.set(error.message);
            return;
          }

          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.passwordError.set('Current password is incorrect.');
            return;
          }

          this.passwordError.set('Failed to change password.');
        },
      });
  }

  onAvatarSelected(event: Event): void {
    if (this.isUploadingAvatar()) {
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

    this.isUploadingAvatar.set(true);
    this.authService
      .uploadAvatar(file)
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.successFlash.show('Photo updated.'),
        error: () => this.avatarError.set('Failed to upload photo.'),
      });
  }

  removeAvatar(): void {
    if (this.isUploadingAvatar() || !this.user()?.avatarUrl) {
      return;
    }

    this.avatarError.set(null);
    this.isUploadingAvatar.set(true);
    this.authService
      .deleteAvatar()
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.successFlash.show('Photo removed.'),
        error: () => this.avatarError.set('Failed to remove photo.'),
      });
  }

  private patchProfile(user: UserResponse): void {
    this.profileForm.patchValue({
      firstName: user.name,
      lastName: user.surname,
      email: user.email,
    });
    this.profileForm.markAsPristine();
  }

  private applyServerErrors(
    form: typeof this.profileForm,
    error: AuthValidationError,
    fieldMap: Record<string, keyof typeof this.profileForm.controls>,
  ): void {
    let hasFieldError = false;

    for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
      const controlName = fieldMap[apiField];
      if (!controlName) {
        continue;
      }

      const control = form.controls[controlName];
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
      hasFieldError = true;
    }

    if (!hasFieldError) {
      this.profileError.set(error.message);
    }
  }

  private clearServerErrors(form: typeof this.profileForm): void {
    for (const control of Object.values(form.controls)) {
      if (!control.hasError('server')) {
        continue;
      }

      const { server: _, ...remainingErrors } = control.errors ?? {};
      control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
    }
  }
}
