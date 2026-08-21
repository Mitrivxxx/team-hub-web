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
    redirectTo: '/app',
    pathMatch: 'full',
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
  },
  {
    path: 'organizations/:slug/manage',
    loadComponent: () =>
      import('./pages/organizations/organization-manage').then((m) => m.OrganizationManage),
  },
  {
    path: 'organizations/:slug/chat',
    loadComponent: () =>
      import('./pages/organizations/chat/organization-chat').then((m) => m.OrganizationChat),
  },
  {
    path: 'organizations/:slug/notifications',
    loadComponent: () =>
      import('./pages/organizations/notifications/organization-notifications').then(
        (m) => m.OrganizationNotifications,
      ),
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
