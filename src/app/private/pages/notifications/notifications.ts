import { DatePipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

export type NotificationKind = 'invite' | 'mention' | 'system' | 'team';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  organization?: string;
  createdAt: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: '1',
    kind: 'invite',
    title: 'Organization invitation',
    body: 'You were invited to join Acme Labs as a Member.',
    organization: 'Acme Labs',
    createdAt: '2026-08-01T16:42:00.000Z',
    read: false,
  },
  {
    id: '2',
    kind: 'mention',
    title: 'You were mentioned',
    body: 'Anna mentioned you in “Q3 planning” in Team Chat.',
    organization: 'Acme Labs',
    createdAt: '2026-08-01T14:10:00.000Z',
    read: false,
  },
  {
    id: '3',
    kind: 'team',
    title: 'Added to a team',
    body: 'You were added to Design System by Marek.',
    organization: 'Northwind',
    createdAt: '2026-07-31T09:25:00.000Z',
    read: true,
  },
  {
    id: '4',
    kind: 'system',
    title: 'Security notice',
    body: 'A new login was detected from Warsaw. If this was not you, change your password.',
    createdAt: '2026-07-30T18:03:00.000Z',
    read: true,
  },
  {
    id: '5',
    kind: 'invite',
    title: 'Invitation accepted',
    body: 'Kasia accepted your invitation to Contoso Hub.',
    organization: 'Contoso Hub',
    createdAt: '2026-07-29T11:48:00.000Z',
    read: true,
  },
];

@Component({
  selector: 'app-notifications',
  imports: [DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications {
  readonly filter = signal<'all' | 'unread'>('all');
  readonly items = signal<AppNotification[]>(MOCK_NOTIFICATIONS);

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  readonly visibleItems = computed(() => {
    const items = this.items();
    return this.filter() === 'unread' ? items.filter((n) => !n.read) : items;
  });

  setFilter(value: 'all' | 'unread'): void {
    this.filter.set(value);
  }

  markAsRead(id: string): void {
    this.items.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  markAllAsRead(): void {
    this.items.update((list) => list.map((item) => ({ ...item, read: true })));
  }

  kindLabel(kind: NotificationKind): string {
    switch (kind) {
      case 'invite':
        return 'Invite';
      case 'mention':
        return 'Mention';
      case 'team':
        return 'Team';
      case 'system':
        return 'System';
    }
  }
}
