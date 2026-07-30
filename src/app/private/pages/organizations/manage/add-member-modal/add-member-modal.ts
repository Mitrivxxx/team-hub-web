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

import { AuthService, UserResponse } from '../../../../../core/auth/auth.service';
import { organizationApiErrorMessage } from '../../../../../core/organizations/organization-api.utils';
import { RoleListItem } from '../../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../../core/organizations/organization.service';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 20;

@Component({
  selector: 'app-add-member-modal',
  imports: [FormsModule],
  templateUrl: './add-member-modal.html',
  styleUrl: './add-member-modal.scss',
})
export class AddMemberModal {
  private readonly organizationService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchRequests = new Subject<string>();
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  readonly organizationId = input.required<string>();
  readonly orgRoles = input.required<RoleListItem[]>();
  readonly existingMemberIds = input<string[]>([]);

  readonly closed = output<void>();
  readonly added = output<void>();

  readonly searchQuery = signal('');
  readonly selectedUser = signal<UserResponse | null>(null);
  readonly results = signal<UserResponse[]>([]);
  readonly isSearching = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly searchError = signal<string | null>(null);
  readonly dropdownOpen = signal(false);
  readonly activeIndex = signal(-1);

  readonly memberIdSet = computed(() => new Set(this.existingMemberIds()));

  readonly filteredResults = computed(() => {
    const excluded = this.memberIdSet();
    return this.results().filter((user) => !excluded.has(user.id));
  });

  readonly memberRoleId = computed(
    () => this.orgRoles().find((r) => r.name === 'Member')?.id ?? this.orgRoles()[0]?.id ?? '',
  );

  readonly canSubmit = computed(() => !!this.selectedUser() && !!this.memberRoleId() && !this.isSubmitting());

  constructor() {
    afterNextRender(() => {
      this.searchInput().nativeElement.focus();
    });

    this.searchRequests
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        filter((q) => q.trim().length > 0),
        switchMap((q) => {
          const term = q.trim();
          this.isSearching.set(true);
          this.searchError.set(null);
          this.activeIndex.set(-1);
          return this.authService.searchUsers(term, SEARCH_PAGE_SIZE).pipe(
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
        this.activeIndex.set(this.filteredResults().length > 0 ? 0 : -1);
        this.scrollActiveIntoView();
      });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.submitError.set(null);
    this.selectedUser.set(null);

    const trimmed = value.trim();
    if (!trimmed) {
      this.clearResults();
      return;
    }

    this.searchRequests.next(trimmed);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.filteredResults();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.dropdownOpen() || results.length === 0) {
        return;
      }
      const next = this.activeIndex() < 0 ? 0 : Math.min(this.activeIndex() + 1, results.length - 1);
      this.activeIndex.set(next);
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.dropdownOpen() || results.length === 0) {
        return;
      }
      const next = this.activeIndex() <= 0 ? 0 : this.activeIndex() - 1;
      this.activeIndex.set(next);
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const index = this.activeIndex();
      if (this.dropdownOpen() && index >= 0 && index < results.length) {
        this.selectUser(results[index]);
      }
    }
  }

  onSearchFocus(): void {
    if (this.filteredResults().length > 0 || this.searchError()) {
      this.dropdownOpen.set(true);
    }
  }

  selectUser(user: UserResponse): void {
    this.selectedUser.set(user);
    this.searchQuery.set(`${user.name} ${user.surname}`.trim());
    this.results.set([]);
    this.dropdownOpen.set(false);
    this.activeIndex.set(-1);
    this.searchError.set(null);
    this.submitError.set(null);
  }

  clearSelection(): void {
    this.selectedUser.set(null);
    this.searchQuery.set('');
    this.clearResults();
    this.submitError.set(null);
    queueMicrotask(() => this.searchInput().nativeElement.focus());
  }

  submit(): void {
    const user = this.selectedUser();
    const roleId = this.memberRoleId();

    if (!user) {
      this.submitError.set('Select a user to add.');
      return;
    }

    if (!roleId) {
      this.submitError.set('Member role is not available.');
      return;
    }

    this.submitError.set(null);
    this.isSubmitting.set(true);

    this.organizationService
      .addMember(this.organizationId(), { userId: user.id, roleIds: [roleId] })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.searchQuery.set('');
          this.selectedUser.set(null);
          this.clearResults();
          this.added.emit();
        },
        error: (err: unknown) =>
          this.submitError.set(organizationApiErrorMessage(err, 'Failed to add member.')),
      });
  }

  initials(user: UserResponse): string {
    const first = user.name?.trim().charAt(0) ?? '';
    const last = user.surname?.trim().charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    if (this.isSubmitting()) {
      return;
    }
    this.closed.emit();
  }

  resultOptionId(index: number): string {
    return `add-member-option-${index}`;
  }

  private clearResults(): void {
    this.results.set([]);
    this.dropdownOpen.set(false);
    this.searchError.set(null);
    this.activeIndex.set(-1);
  }

  private scrollActiveIntoView(): void {
    const index = this.activeIndex();
    if (index < 0) {
      return;
    }
    queueMicrotask(() => {
      document.getElementById(this.resultOptionId(index))?.scrollIntoView({ block: 'nearest' });
    });
  }
}
