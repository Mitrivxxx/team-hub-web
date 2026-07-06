import { Routes } from '@angular/router';
import { Dashboard } from './private/pages/dashboard/dashboard';
import { ServicePlaceholder } from './private/pages/service-placeholder/service-placeholder';
import { publicRoutes } from './public/public.routes';

export const routes: Routes = [
  ...publicRoutes,
  {
    path: 'app',
    component: Dashboard,
  },
  {
    path: 'app/chat',
    component: ServicePlaceholder,
    data: {
      title: 'Team Chat',
      description: 'Tutaj pojawi sie komunikator zespolowy z rozmowami prywatnymi i kanalami.',
    },
  },
  {
    path: 'app/documents',
    component: ServicePlaceholder,
    data: {
      title: 'Dokumenty',
      description: 'Tutaj pojawi sie edytor oraz zapisywanie dokumentow i wspolna praca zespolowa.',
    },
  },
  {
    path: 'app/meetings',
    component: ServicePlaceholder,
    data: {
      title: 'Team Meetings',
      description: 'Tutaj pojawia sie wideospotkania, harmonogram i szybkie dolaczanie do pokoju.',
    },
  },
];
