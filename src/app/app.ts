import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { AppLoader } from './core/components/app-loader/app-loader';
import { Footer } from './public/components/footer/footer';
import { Header } from './public/components/header/header';
import { PUBLIC_AUTH_ROUTES } from './public/public.constants';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, AppLoader],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  constructor() {
    this.authService.initialize().subscribe();
  }

  readonly showLayout = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => !this.isAuthRoute()),
      startWith(!this.isAuthRoute()),
    ),
    { initialValue: !this.isAuthRoute() },
  );

  readonly showFooter = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.isHomeRoute()),
      startWith(this.isHomeRoute()),
    ),
    { initialValue: this.isHomeRoute() },
  );

  private isAuthRoute(): boolean {
    return PUBLIC_AUTH_ROUTES.some((route) => this.router.url.startsWith(route));
  }

  private isHomeRoute(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/' || path === '';
  }
}
