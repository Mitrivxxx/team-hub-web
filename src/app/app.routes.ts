import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./public/public.routes').then((m) => m.publicRoutes),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadChildren: () => import('./private/private.routes').then((m) => m.privateRoutes),
  },
];
