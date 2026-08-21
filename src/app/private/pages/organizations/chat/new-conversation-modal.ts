import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  of,
  switchMap,
} from 'rxjs';

import { AuthService, UserResponse } from '../../../../core/auth/auth.service';
import { ChatService } from '../../../../core/chat/chat.service';
import { Conversation, ConversationType } from '../../../../core/chat/chat.models';

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-new-conversation-modal',
  imports: [FormsModule],
  templateUrl: './new-conversation-modal.html',
  styleUrl: './new-conversation-modal.scss',
})
export class NewConversationModal {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchRequests = new Subject<string>();
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly organizationId = input.required<string>();
  readonly currentUserId = input.required<string>();

  readonly closed = output<void>();
  readonly created = output<Conversation>();

  readonly type = signal<ConversationType>('GROUP');
  readonly name = signal('');
  readonly searchQuery = signal('');
  readonly results = signal<UserResponse[]>([]);
  readonly selected = signal<UserResponse[]>([]);
  readonly isSearching = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchError = signal<string | null>(null);
  readonly dropdownOpen = signal(false);

  readonly selectedIds = computed(() => new Set(this.selected().map((u) => u.id)));

  readonly filteredResults = computed(() => {
    const picked = this.selectedIds();
    const me = this.currentUserId();
    return this.results().filter((u) => u.id !== me && !picked.has(u.id));
  });

  readonly canSubmit = computed(() => {
    if (this.isSubmitting()) {
      return false;
    }
    if (this.type() === 'DIRECT') {
      return this.selected().length === 1;
    }
    return this.name().trim().length > 0 && this.selected().length >= 0;
  });

  constructor() {
    afterNextRender(() => this.searchInput()?.nativeElement.focus());

    this.searchRequests
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        filter((q) => q.trim().length >= 2),
        switchMap((q) => {
          this.isSearching.set(true);
          this.searchError.set(null);
          return this.authService.searchUsers(q.trim()).pipe(
            catchError(() => {
              this.searchError.set('Failed to search users.');
              return of([] as UserResponse[]);
            }),
            finalize(() => this.isSearching.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((users) => {
        this.results.set(users);
        this.dropdownOpen.set(true);
      });
  }

  setType(value: ConversationType): void {
    this.type.set(value);
    this.error.set(null);
    if (value === 'DIRECT' && this.selected().length > 1) {
      this.selected.set(this.selected().slice(0, 1));
    }
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (value.trim().length < 2) {
      this.results.set([]);
      this.dropdownOpen.set(false);
      return;
    }
    this.searchRequests.next(value);
  }

  pickUser(user: UserResponse): void {
    if (this.type() === 'DIRECT') {
      this.selected.set([user]);
    } else if (!this.selectedIds().has(user.id)) {
      this.selected.update((list) => [...list, user]);
    }
    this.searchQuery.set('');
    this.results.set([]);
    this.dropdownOpen.set(false);
  }

  removeUser(userId: string): void {
    this.selected.update((list) => list.filter((u) => u.id !== userId));
  }

  displayName(user: UserResponse): string {
    const full = `${user.name} ${user.surname}`.trim();
    return full || user.username;
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.isSubmitting.set(true);
    this.error.set(null);

    const memberUserIds = this.selected().map((u) => u.id);
    const body =
      this.type() === 'DIRECT'
        ? { type: 'DIRECT' as const, memberUserIds }
        : { type: 'GROUP' as const, name: this.name().trim(), memberUserIds };

    this.chatService
      .createConversation(this.organizationId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conversation) => {
          this.isSubmitting.set(false);
          this.created.emit(conversation);
        },
        error: (err: { error?: { detail?: string }; status?: number }) => {
          this.isSubmitting.set(false);
          this.error.set(
            err?.error?.detail ??
              (err?.status === 409
                ? 'Conversation already exists.'
                : 'Could not create conversation.'),
          );
        },
      });
  }

  close(): void {
    if (!this.isSubmitting()) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }
}
