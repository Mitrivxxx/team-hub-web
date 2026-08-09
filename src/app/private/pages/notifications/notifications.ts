import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  NotificationDto,
  NotificationService,
} from '../../../core/notifications/notification.service';

export type NotificationKind = 'invite' | 'mention' | 'system' | 'team' | 'member';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  organization?: string;
  createdAt: string;
  read: boolean;
}

@Component({
  selector: 'app-notifications',
  imports: [DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly filter = signal<'all' | 'unread'>('all');
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  readonly visibleItems = computed(() => {
    const items = this.items();
    return this.filter() === 'unread' ? items.filter((n) => !n.read) : items;
  });

  ngOnInit(): void {
    this.reload();
  }

  setFilter(value: 'all' | 'unread'): void {
    this.filter.set(value);
  }

  markAsRead(id: string): void {
    this.notificationService
      .markAsRead(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) =>
            list.map((item) => (item.id === id ? { ...item, read: true } : item)),
          );
        },
        error: () => this.error.set('Could not mark notification as read.'),
      });
  }

  markAllAsRead(): void {
    this.notificationService
      .markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((list) => list.map((item) => ({ ...item, read: true })));
        },
        error: () => this.error.set('Could not mark notifications as read.'),
      });
  }

  kindLabel(kind: NotificationKind): string {
    switch (kind) {
      case 'invite':
        return 'Invite';
      case 'mention':
        return 'Mention';
      case 'team':
        return 'Team';
      case 'member':
        return 'Member';
      case 'system':
        return 'System';
    }
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notificationService
      .listMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items.map((item) => this.mapDto(item)));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load notifications.');
          this.loading.set(false);
        },
      });
  }

  private mapDto(dto: NotificationDto): AppNotification {
    return {
      id: dto.id,
      kind: this.mapKind(dto.type),
      title: dto.title,
      body: dto.body,
      organization: dto.organizationId ?? undefined,
      createdAt: dto.createdAt,
      read: dto.isRead,
    };
  }

  private mapKind(type: string): NotificationKind {
    if (type.includes('member')) {
      return 'member';
    }
    if (type.includes('invite')) {
      return 'invite';
    }
    if (type.includes('team')) {
      return 'team';
    }
    return 'system';
  }
}
