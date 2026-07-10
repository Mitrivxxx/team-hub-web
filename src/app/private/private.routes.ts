import { Routes } from '@angular/router';

export const privateRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./pages/service-placeholder/service-placeholder').then((m) => m.ServicePlaceholder),
    data: {
      title: 'Team Chat',
      description: 'Tutaj pojawi sie komunikator zespolowy z rozmowami prywatnymi i kanalami.',
    },
  },
  {
    path: 'documents',
    loadComponent: () =>
      import('./pages/service-placeholder/service-placeholder').then((m) => m.ServicePlaceholder),
    data: {
      title: 'Dokumenty',
      description: 'Tutaj pojawi sie edytor oraz zapisywanie dokumentow i wspolna praca zespolowa.',
    },
  },
  {
    path: 'meetings',
    loadComponent: () =>
      import('./pages/service-placeholder/service-placeholder').then((m) => m.ServicePlaceholder),
    data: {
      title: 'Team Meetings',
      description: 'Tutaj pojawia sie wideospotkania, harmonogram i szybkie dolaczanie do pokoju.',
    },
  },
];
