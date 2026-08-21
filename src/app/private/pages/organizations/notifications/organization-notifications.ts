import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  NotificationDto,
  NotificationService,
} from '../../../../core/notifications/notification.service';
import { Organization } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

export type NotificationKind = 'invite' | 'mention' | 'system' | 'team' | 'member';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

@Component({
  selector: 'app-organization-notifications',
  imports: [DatePipe, RouterLink],
  templateUrl: './organization-notifications.html',
  styleUrl: './organization-notifications.scss',
})
export class OrganizationNotifications implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly organization = signal<Organization | null>(null);

  readonly accessLoading = signal(true);
  readonly accessDenied = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly filter = signal<'all' | 'unread'>('all');
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);

  readonly visibleItems = computed(() => {
    const items = this.items();
    return this.filter() === 'unread' ? items.filter((n) => !n.read) : items;
  });

  ngOnInit(): void {
    if (!this.slug) {
      this.accessLoading.set(false);
      this.loadError.set('Organization not found.');
      return;
    }

    this.organizationService
      .getBySlug(this.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (organization) => {
          this.organization.set(organization);
          this.validateMembership(organization.id);
        },
        error: () => {
          this.loadError.set('Failed to load organization.');
          this.accessLoading.set(false);
        },
      });
  }

  displayOrgName(): string {
    return this.organization()?.name ?? this.slug;
  }

  setFilter(value: 'all' | 'unread'): void {
    this.filter.set(value);
  }

  markAsRead(id: string): void {
    const organizationId = this.organization()?.id;
    if (!organizationId) {
      return;
    }

    this.notificationService
      .markAsRead(organizationId, id)
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
    const organizationId = this.organization()?.id;
    if (!organizationId) {
      return;
    }

    this.notificationService
      .markAllAsRead(organizationId)
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

  private validateMembership(organizationId: string): void {
    this.organizationService
      .getMe(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.accessDenied.set(false);
          this.accessLoading.set(false);
          this.reload();
        },
        error: () => {
          this.accessDenied.set(true);
          this.accessLoading.set(false);
        },
      });
  }

  private reload(): void {
    const organizationId = this.organization()?.id;
    if (!organizationId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.notificationService
      .listForOrganization(organizationId)
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
