import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  showPassword = false;
  isSubmitting = false;

  readonly forgotPasswordForm = this.formBuilder.nonNullable.group({
    username: [{ value: '', disabled: true }, [Validators.required]],
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
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

    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    
    // Simulate API call for setting new password
    setTimeout(() => {
      this.isSubmitting = false;
      alert('Password reset successfully! (Simulated)');
      void this.router.navigate(['/login']);
    }, 1000);
  }
}
