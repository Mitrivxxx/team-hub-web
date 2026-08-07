import { Routes } from '@angular/router';

export const privateRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/organizations/organization-list').then((m) => m.OrganizationList),
  },
  {
    path: 'invitations/accept',
    loadComponent: () =>
      import('./pages/invitations/invitation-accept').then((m) => m.InvitationAccept),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./pages/notifications/notifications').then((m) => m.Notifications),
  },
  {
    path: 'organizations/:slug/manage',
    loadComponent: () =>
      import('./pages/organizations/organization-manage').then((m) => m.OrganizationManage),
  },
  {
    path: 'organizations/:slug',
    loadComponent: () =>
      import('./pages/organizations/organization-placeholder').then((m) => m.OrganizationPlaceholder),
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
