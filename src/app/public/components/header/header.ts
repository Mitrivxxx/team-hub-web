import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
    });
  }
}
