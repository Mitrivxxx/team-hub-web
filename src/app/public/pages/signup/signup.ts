import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, AuthValidationError } from '../../../core/auth/auth.service';
import { humanNameValidator, usernameFormatValidator } from '../../../core/auth/register.validators';

function passwordsMatch(control: AbstractControl): { passwordMismatch: true } | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (password !== confirmPassword) {
    return { passwordMismatch: true };
  }

  return null;
}

const registerFieldToFormControl = {
  name: 'firstName',
  surname: 'lastName',
  username: 'username',
  password: 'password',
} as const;

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  showPassword = false;
  showConfirmPassword = false;
  isSubmitting = false;
  submitError: string | null = null;

  readonly signupForm = this.formBuilder.nonNullable.group(
    {
      firstName: ['', [Validators.required, humanNameValidator(50)]],
      lastName: ['', [Validators.required, humanNameValidator(80)]],
      username: ['', [Validators.required, usernameFormatValidator]],
      password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  preventFocusLoss(event: MouseEvent): void {
    event.preventDefault();
  }

  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.submitError = null;
    this.clearServerErrors();

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const { firstName, lastName, username, password } = this.signupForm.getRawValue();
    this.isSubmitting = true;

    this.authService
      .register({
        username,
        name: firstName,
        surname: lastName,
        password,
      })
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/app']);
        },
        error: (error: unknown) => {
          if (error instanceof AuthValidationError) {
            this.applyServerErrors(error);
            return;
          }

          this.submitError = 'Registration failed. Please try again.';
        },
      });
  }

  private applyServerErrors(error: AuthValidationError): void {
    let hasFieldError = false;

    for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
      const controlName = registerFieldToFormControl[apiField as keyof typeof registerFieldToFormControl];
      if (!controlName) {
        continue;
      }

      const control = this.signupForm.controls[controlName];
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
      hasFieldError = true;
    }

    if (!hasFieldError) {
      this.submitError = error.message;
    }
  }

  private clearServerErrors(): void {
    for (const control of Object.values(this.signupForm.controls)) {
      if (!control.hasError('server')) {
        continue;
      }

      const { server: _, ...remainingErrors } = control.errors ?? {};
      control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
    }
  }
}
