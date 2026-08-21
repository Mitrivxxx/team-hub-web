import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  Conversation,
  ConversationMember,
  ConversationPin,
  ConversationSettings,
  Message,
} from '../../../../core/chat/chat.models';
import { ChatService } from '../../../../core/chat/chat.service';
import { Organization } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { NewConversationModal } from './new-conversation-modal';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀'];

@Component({
  selector: 'app-organization-chat',
  imports: [RouterLink, DatePipe, FormsModule, NewConversationModal],
  templateUrl: './organization-chat.html',
  styleUrl: './organization-chat.scss',
})
export class OrganizationChat implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly organization = signal<Organization | null>(null);
  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? '');

  readonly accessLoading = signal(true);
  readonly accessDenied = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly conversations = signal<Conversation[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal<string | null>(null);

  readonly selectedId = signal<string | null>(null);
  readonly members = signal<ConversationMember[]>([]);
  readonly messages = signal<Message[]>([]);
  readonly threadLoading = signal(false);
  readonly threadError = signal<string | null>(null);
  readonly composerText = signal('');
  readonly sending = signal(false);
  readonly showNewModal = signal(false);
  readonly menuOpen = signal(false);
  readonly pin = signal<ConversationPin | null>(null);
  readonly settings = signal<ConversationSettings | null>(null);
  readonly pendingFile = signal<File | null>(null);

  readonly selected = computed(() =>
    this.conversations().find((c) => c.id === this.selectedId()) ?? null,
  );

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

  conversationTitle(conversation: Conversation): string {
    if (conversation.type === 'GROUP') {
      return conversation.name?.trim() || 'Group chat';
    }
    return 'Direct message';
  }

  isMine(message: Message): boolean {
    return message.senderId === this.currentUserId();
  }

  myReaction(message: Message): string | null {
    const mine = message.reactions.find((r) => r.userId === this.currentUserId());
    return mine?.reaction ?? null;
  }

  reloadConversations(selectId?: string): void {
    const orgId = this.organization()?.id;
    if (!orgId) {
      return;
    }
    this.listLoading.set(true);
    this.listError.set(null);
    this.chatService
      .listConversations(orgId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.conversations.set(page.items);
          this.listLoading.set(false);
          const nextId = selectId ?? this.selectedId() ?? page.items[0]?.id ?? null;
          if (nextId) {
            this.selectConversation(nextId);
          }
        },
        error: () => {
          this.listError.set('Could not load conversations.');
          this.listLoading.set(false);
        },
      });
  }

  selectConversation(conversationId: string): void {
    this.selectedId.set(conversationId);
    this.menuOpen.set(false);
    this.loadThread(conversationId);
  }

  loadOlder(): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    const oldest = this.messages()[0];
    if (!orgId || !conversationId || !oldest) {
      return;
    }
    this.chatService
      .listMessages(orgId, conversationId, { before: oldest.id, pageSize: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (page.items.length) {
            this.messages.update((current) => [...page.items, ...current]);
          }
        },
      });
  }

  sendMessage(): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    const text = this.composerText().trim();
    const file = this.pendingFile();
    if (!orgId || !conversationId || this.sending() || (!text && !file)) {
      return;
    }

    this.sending.set(true);
    this.threadError.set(null);
    this.chatService
      .sendMessage(orgId, conversationId, {
        content: text || (file ? file.name : ''),
        messageType: 'TEXT',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (message) => {
          this.composerText.set('');
          if (file) {
            this.chatService
              .uploadAttachment(orgId, conversationId, message.id, file)
              .pipe(
                catchError(() => {
                  this.threadError.set('Message sent, but attachment upload failed.');
                  return of(null);
                }),
                takeUntilDestroyed(this.destroyRef),
              )
              .subscribe((attachment) => {
                this.pendingFile.set(null);
                const withAttachment =
                  attachment == null
                    ? message
                    : {
                        ...message,
                        attachments: [...message.attachments, attachment],
                      };
                this.messages.update((list) => [...list, withAttachment]);
                this.bumpConversation(conversationId);
                this.markLatestRead(withAttachment.id);
                this.sending.set(false);
              });
          } else {
            this.messages.update((list) => [...list, message]);
            this.bumpConversation(conversationId);
            this.markLatestRead(message.id);
            this.sending.set(false);
          }
        },
        error: () => {
          this.threadError.set('Could not send message.');
          this.sending.set(false);
        },
      });
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pendingFile.set(file);
    input.value = '';
  }

  clearPendingFile(): void {
    this.pendingFile.set(null);
  }

  openFilePicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  toggleReaction(message: Message, reaction: string): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    const current = this.myReaction(message);
    const onDone = () => this.refreshMessage(message.id);
    if (current === reaction) {
      this.chatService
        .deleteReaction(orgId, conversationId, message.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: onDone });
      return;
    }
    this.chatService
      .setReaction(orgId, conversationId, message.id, reaction)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: onDone });
  }

  pinMessage(message: Message): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    this.chatService
      .setPin(orgId, conversationId, message.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pin) => this.pin.set(pin),
      });
  }

  clearPin(): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    this.chatService
      .deletePin(orgId, conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.pin.set(null),
        error: () => this.pin.set(null),
      });
  }

  toggleMute(): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    const settings = this.settings();
    if (!orgId || !conversationId || !settings) {
      return;
    }
    const enabled = !settings.notificationsEnabled;
    this.chatService
      .updateSettings(orgId, conversationId, {
        notificationsEnabled: enabled,
        mutedUntil: enabled ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (next) => this.settings.set(next),
      });
  }

  leaveConversation(): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    this.chatService
      .leaveConversation(orgId, conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.conversations.update((list) => list.filter((c) => c.id !== conversationId));
          this.selectedId.set(null);
          this.messages.set([]);
          this.menuOpen.set(false);
        },
        error: (err: { error?: { detail?: string } }) => {
          this.threadError.set(err?.error?.detail ?? 'Could not leave conversation.');
        },
      });
  }

  onConversationCreated(conversation: Conversation): void {
    this.showNewModal.set(false);
    this.conversations.update((list) => [conversation, ...list.filter((c) => c.id !== conversation.id)]);
    this.selectConversation(conversation.id);
  }

  pinnedMessageContent(): string | null {
    const pin = this.pin();
    if (!pin) {
      return null;
    }
    const message = this.messages().find((m) => m.id === pin.messageId);
    if (!message || message.deletedAt) {
      return `Message ${pin.messageId.slice(0, 8)}…`;
    }
    return message.content?.trim() || 'Pinned message';
  }

  readonly quickReactions = QUICK_REACTIONS;

  private validateMembership(organizationId: string): void {
    this.organizationService
      .getMe(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.accessDenied.set(false);
          this.accessLoading.set(false);
          this.reloadConversations();
        },
        error: () => {
          this.accessDenied.set(true);
          this.accessLoading.set(false);
        },
      });
  }

  private loadThread(conversationId: string): void {
    const orgId = this.organization()?.id;
    if (!orgId) {
      return;
    }
    this.threadLoading.set(true);
    this.threadError.set(null);
    this.messages.set([]);
    this.pin.set(null);

    this.chatService
      .listMessages(orgId, conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.messages.set(page.items);
          this.threadLoading.set(false);
          const latest = page.items[page.items.length - 1];
          if (latest) {
            this.markLatestRead(latest.id);
          }
        },
        error: () => {
          this.threadError.set('Could not load messages.');
          this.threadLoading.set(false);
        },
      });

    this.chatService
      .listMembers(orgId, conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => this.members.set(members),
        error: () => this.members.set([]),
      });

    this.chatService
      .getPin(orgId, conversationId)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((pin) => this.pin.set(pin));

    this.chatService
      .getSettings(orgId, conversationId)
      .pipe(
        catchError(() =>
          of({
            notificationsEnabled: true,
            mutedUntil: null,
            updatedAt: new Date().toISOString(),
          } satisfies ConversationSettings),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((settings) => this.settings.set(settings));
  }

  private markLatestRead(messageId: string): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    this.chatService
      .markRead(orgId, conversationId, messageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  private bumpConversation(conversationId: string): void {
    const now = new Date().toISOString();
    this.conversations.update((list) => {
      const next = list.map((c) =>
        c.id === conversationId ? { ...c, lastMessageAt: now, updatedAt: now } : c,
      );
      return [...next].sort((a, b) => {
        const aTime = a.lastMessageAt ?? a.createdAt;
        const bTime = b.lastMessageAt ?? b.createdAt;
        return bTime.localeCompare(aTime);
      });
    });
  }

  private refreshMessage(messageId: string): void {
    const orgId = this.organization()?.id;
    const conversationId = this.selectedId();
    if (!orgId || !conversationId) {
      return;
    }
    this.chatService
      .listMessages(orgId, conversationId, { pageSize: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const updated = page.items.find((m) => m.id === messageId);
          if (!updated) {
            return;
          }
          this.messages.update((list) => list.map((m) => (m.id === messageId ? updated : m)));
        },
      });
  }
}
