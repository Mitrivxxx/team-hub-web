import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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

  showPassword = false;
  isSubmitting = false;

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
          void this.router.navigate(['/app']);
        },
      });
  }
}
