import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Footer } from './components/footer/footer';
import { Header } from './components/header/header';

const AUTH_ROUTES = ['/login', '/signup'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);

  readonly showLayout = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => !this.isAuthRoute()),
      startWith(!this.isAuthRoute()),
    ),
    { initialValue: !this.isAuthRoute() },
  );

  private isAuthRoute(): boolean {
    return AUTH_ROUTES.some((route) => this.router.url.startsWith(route));
  }
}
