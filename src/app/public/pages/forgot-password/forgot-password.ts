import { Component, inject, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, AuthValidationError } from '../../../core/auth/auth.service';
import { humanNameValidator } from '../../../core/auth/register.validators';

const changePasswordFieldToFormControl = {
  name: 'firstName',
  surname: 'lastName',
  username: 'username',
  password: 'newPassword',
} as const;

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  showPassword = false;
  isSubmitting = false;
  submitError: string | null = null;

  readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    username: [{ value: '', disabled: true }, [Validators.required]],
    firstName: ['', [Validators.required, humanNameValidator(50)]],
    lastName: ['', [Validators.required, humanNameValidator(80)]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const username = params['username'] || '';
      this.forgotPasswordForm.controls.username.setValue(username);
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  preventFocusLoss(event: MouseEvent): void {
    event.preventDefault();
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    this.submitError = null;
    this.clearServerErrors();

    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const { username, firstName, lastName, newPassword } = this.forgotPasswordForm.getRawValue();
    this.isSubmitting = true;

    this.authService
      .changePassword({
        username,
        name: firstName,
        surname: lastName,
        password: newPassword,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
        error: (error: unknown) => {
          if (error instanceof AuthValidationError) {
            this.applyServerErrors(error);
            return;
          }

          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.submitError = 'Identity verification failed. Check your details and try again.';
            return;
          }

          this.submitError = 'Password reset failed. Please try again.';
        },
      });
  }

  private applyServerErrors(error: AuthValidationError): void {
    let hasFieldError = false;

    for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
      const controlName =
        changePasswordFieldToFormControl[apiField as keyof typeof changePasswordFieldToFormControl];
      if (!controlName) {
        continue;
      }

      const control = this.forgotPasswordForm.controls[controlName];
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
      hasFieldError = true;
    }

    if (!hasFieldError) {
      this.submitError = error.message;
    }
  }

  private clearServerErrors(): void {
    for (const control of Object.values(this.forgotPasswordForm.controls)) {
      if (!control.hasError('server')) {
        continue;
      }

      const { server: _, ...remainingErrors } = control.errors ?? {};
      control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
    }
  }
}
