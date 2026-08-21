import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

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
  readonly appsOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly organizationSlug = computed(() => {
    const match = this.url().match(/\/app\/organizations\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  readonly organizationLink = computed(() => {
    const slug = this.organizationSlug();
    return slug ? ['/app/organizations', slug] : ['/app'];
  });

  readonly chatLink = computed(() => {
    const slug = this.organizationSlug();
    return slug ? ['/app/organizations', slug, 'chat'] : ['/app'];
  });

  readonly notificationsLink = computed(() => {
    const slug = this.organizationSlug();
    return slug ? ['/app/organizations', slug, 'notifications'] : ['/app'];
  });

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
    this.appsOpen.set(false);
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  toggleApps(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.set(false);
    this.appsOpen.update((open) => !open);
  }

  closeApps(): void {
    this.appsOpen.set(false);
  }

  onLogout(): void {
    this.closeUserMenu();
    this.closeApps();
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigate(['/']);
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen() && !this.appsOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeUserMenu();
      this.closeApps();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
    this.closeApps();
  }
}
