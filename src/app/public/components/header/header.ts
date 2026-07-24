import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { OrgManageLayoutService } from '../../../core/layout/org-manage-layout.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly authService = inject(AuthService);
  protected readonly orgManageLayout = inject(OrgManageLayoutService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly userMenuOpen = signal(false);

  readonly userInitials = computed(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return '?';
    }
    const first = user.name.trim().charAt(0);
    const last = user.surname.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || user.username.charAt(0).toUpperCase();
  });

  readonly userDisplayName = computed(() => {
    const user = this.authService.currentUser();
    if (!user) {
      return '';
    }
    return `${user.name} ${user.surname}`.trim() || user.username;
  });

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  onLogout(): void {
    this.closeUserMenu();
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeUserMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
  }
}
