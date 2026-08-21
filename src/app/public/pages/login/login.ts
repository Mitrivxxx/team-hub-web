import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  showPassword = false;
  isSubmitting = false;
  submitError: string | null = null;
  remainingAttempts: number | null = null;
  lockoutSeconds: number | null = null;

  readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  preventFocusLoss(event: MouseEvent): void {
    event.preventDefault();
  }

  goToForgotPassword(): void {
    const username = this.loginForm.controls.username.value.trim();
    if (!username) {
      this.loginForm.controls.username.setErrors({ required: true });
      this.loginForm.controls.username.markAsTouched();
      return;
    }
    void this.router.navigate(['/forgot-password'], { queryParams: { username } });
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.submitError = null;
    this.remainingAttempts = null;
    this.lockoutSeconds = null;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { username, password, rememberMe } = this.loginForm.getRawValue();
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      this.loginForm.controls.username.setErrors({ required: true });
      this.loginForm.controls.username.markAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.authService.login(normalizedUsername, password, rememberMe)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(this.postLoginUrl());
        },
        error: (error: unknown) => {
          this.applyServerError(error);
        },
      });
  }

  private applyServerError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const status = error.status;
      const body = error.error as unknown;
      if (body && typeof body === 'object') {
        const payload = body as { remainingAttempts?: unknown; lockoutSeconds?: unknown; code?: unknown };
        const remaining = payload.remainingAttempts;
        const lockout = payload.lockoutSeconds;

        if (status === 401) {
          if (typeof remaining === 'number') {
            this.remainingAttempts = remaining;
            this.submitError = `Invalid username or password. Remaining login attempts: ${remaining}.`;
            return;
          }
          this.submitError = 'Invalid username or password.';
          return;
        }

        if (status === 423) {
          if (typeof lockout === 'number') {
            this.lockoutSeconds = lockout;
            this.submitError = `Account is locked due to too many failed login attempts. Try again in ${lockout} seconds.`;
            return;
          }
          this.submitError = 'Account is locked due to too many failed login attempts.';
          return;
        }
      }
    }

    this.submitError = 'Login failed. Please try again.';
  }

  private postLoginUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl?.startsWith('/app') && !returnUrl.startsWith('//') && !returnUrl.includes('\\')) {
      return returnUrl;
    }

    return '/app';
  }
}
