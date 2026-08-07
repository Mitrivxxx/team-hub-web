import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  MeMembership,
  Organization,
  RoleListItem,
  Team,
  TeamMember,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';
import { OverflowMenu } from '../../../../shared/overflow-menu/overflow-menu';
import { OverflowMenuItem } from '../../../../shared/overflow-menu/overflow-menu.model';
import { TablePagination } from '../../../../shared/table-pagination/table-pagination';
import { AddTeamModal } from './add-team-modal/add-team-modal';

type SortColumn = 'name' | 'members' | 'created';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 20;

@Component({
  selector: 'app-org-teams-panel',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    OverflowMenu,
    TablePagination,
    AddTeamModal,
  ],
  templateUrl: './org-teams-panel.html',
  styleUrl: './org-teams-panel.scss',
})
export class OrgTeamsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly successFlash = createFlashMessage(this.destroyRef);
  private readonly searchRequests = new Subject<string>();

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();
  readonly addTeamRequest = input(0);

  readonly teams = signal<Team[]>([]);
  readonly teamRoles = signal<RoleListItem[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = this.successFlash.message;
  readonly showAddTeamModal = signal(false);

  readonly searchQuery = signal('');
  readonly sortColumn = signal<SortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>('asc');
  readonly currentPage = signal(1);

  readonly detailsTeamId = signal<string | null>(null);
  readonly detailsMembers = signal<TeamMember[]>([]);
  readonly detailsLoading = signal(false);
  readonly detailsError = signal<string | null>(null);
  readonly isAddingMember = signal(false);
  readonly isSavingTeam = signal(false);
  readonly isUploadingAvatar = signal(false);
  readonly editingMemberUserId = signal<string | null>(null);
  readonly isSavingMember = signal(false);
  readonly avatarError = signal<string | null>(null);

  readonly memberSearchQuery = signal('');
  readonly selectedUser = signal<UserResponse | null>(null);
  readonly memberSearchResults = signal<UserResponse[]>([]);
  readonly isSearchingMembers = signal(false);
  readonly memberSearchError = signal<string | null>(null);
  readonly memberDropdownOpen = signal(false);

  readonly canManage = () => this.me().permissions.includes('org.teams.manage');

  readonly addMemberForm = this.formBuilder.nonNullable.group({
    roleId: ['', Validators.required],
    jobTitle: ['', Validators.maxLength(100)],
  });

  readonly editTeamForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
  });

  readonly editMemberForm = this.formBuilder.nonNullable.group({
    roleId: ['', Validators.required],
    jobTitle: ['', Validators.maxLength(100)],
  });

  readonly filteredTeams = computed(() => {
    const search = this.searchQuery().trim().toLowerCase();

    let result = this.teams().filter((team) => {
      const name = team.name.toLowerCase();
      const description = (team.description ?? '').toLowerCase();
      if (search && !`${name} ${description}`.includes(search)) {
        return false;
      }
      return true;
    });

    const column = this.sortColumn();
    const direction = this.sortDirection();
    if (column) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        if (column === 'name') {
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        } else if (column === 'members') {
          comparison = a.memberCount - b.memberCount;
        } else if (column === 'created') {
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  });

  readonly totalPages = computed(() => {
    const total = this.filteredTeams().length;
    return total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  });

  readonly pagedTeams = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredTeams().slice(start, start + PAGE_SIZE);
  });

  readonly detailsTeam = computed(() => {
    const id = this.detailsTeamId();
    return id ? (this.teams().find((t) => t.id === id) ?? null) : null;
  });

  readonly teamMemberIdSet = computed(() => new Set(this.detailsMembers().map((m) => m.userId)));

  readonly filteredMemberResults = computed(() => {
    const excluded = this.teamMemberIdSet();
    return this.memberSearchResults().filter((user) => !excluded.has(user.id));
  });

  /** Baseline so remounting the panel (tab switch) does not re-open the modal. */
  private lastSeenAddTeamRequest: number | null = null;

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });

    effect(() => {
      const request = this.addTeamRequest();
      const previous = this.lastSeenAddTeamRequest;
      this.lastSeenAddTeamRequest = request;
      if (previous !== null && request > previous && this.canManage()) {
        this.showAddTeamModal.set(true);
      }
    });

    effect(() => {
      this.searchQuery();
      this.sortColumn();
      this.sortDirection();
      this.teams();
      this.currentPage.set(1);
    });

    this.searchRequests
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        filter((q) => q.trim().length > 0),
        switchMap((q) => {
          this.isSearchingMembers.set(true);
          this.memberSearchError.set(null);
          return this.authService.searchUsers(q.trim(), SEARCH_PAGE_SIZE).pipe(
            catchError(() => {
              this.memberSearchError.set('Failed to search users.');
              return of([] as UserResponse[]);
            }),
            finalize(() => this.isSearchingMembers.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((users) => {
        this.memberSearchResults.set(users);
        this.memberDropdownOpen.set(true);
      });
  }

  sortIndicator(column: SortColumn): string {
    if (this.sortColumn() !== column) {
      return '';
    }
    return this.sortDirection() === 'asc' ? ' ↑' : ' ↓';
  }

  toggleSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('asc');
  }

  menuItems(_team: Team): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [{ id: 'details', label: 'Details' }];
    if (this.canManage()) {
      items.push({ id: 'delete', label: 'Delete', danger: true });
    }
    return items;
  }

  onMenuAction(team: Team, actionId: string): void {
    if (actionId === 'details') {
      this.openDetails(team);
      return;
    }
    if (actionId === 'delete') {
      this.deleteTeam(team);
    }
  }

  openDetails(team: Team): void {
    if (this.detailsTeamId() === team.id) {
      return;
    }

    this.detailsTeamId.set(team.id);
    this.detailsMembers.set([]);
    this.detailsError.set(null);
    this.detailsLoading.set(true);
    this.avatarError.set(null);
    this.editingMemberUserId.set(null);
    this.resetAddMemberForm();
    this.editTeamForm.patchValue({
      name: team.name,
      description: team.description ?? '',
    });
    this.editTeamForm.markAsPristine();

    this.organizationService
      .listTeamMembers(this.organization().id, team.id)
      .pipe(
        finalize(() => this.detailsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (members) => this.detailsMembers.set(members),
        error: (err: unknown) =>
          this.detailsError.set(organizationApiErrorMessage(err, 'Failed to load team members.')),
      });
  }

  closeDetails(): void {
    this.detailsTeamId.set(null);
    this.detailsMembers.set([]);
    this.detailsError.set(null);
    this.detailsLoading.set(false);
    this.avatarError.set(null);
    this.editingMemberUserId.set(null);
    this.resetAddMemberForm();
  }

  saveTeamDetails(): void {
    const teamId = this.detailsTeamId();
    if (!teamId || !this.canManage() || this.isSavingTeam()) {
      return;
    }

    if (this.editTeamForm.invalid) {
      this.editTeamForm.markAllAsTouched();
      return;
    }

    const { name, description } = this.editTeamForm.getRawValue();
    this.actionError.set(null);
    this.successFlash.clear();
    this.isSavingTeam.set(true);

    this.organizationService
      .updateTeam(this.organization().id, teamId, {
        name: name.trim(),
        description: description.trim() || null,
      })
      .pipe(
        finalize(() => this.isSavingTeam.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.teams.update((items) => items.map((t) => (t.id === updated.id ? updated : t)));
          this.editTeamForm.markAsPristine();
          this.successFlash.show('Team updated.');
        },
        error: (err: unknown) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to update team.')),
      });
  }

  onTeamAvatarSelected(event: Event): void {
    const teamId = this.detailsTeamId();
    if (!teamId || !this.canManage() || this.isUploadingAvatar()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.avatarError.set(null);

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.avatarError.set('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.avatarError.set('Image must be 2 MB or smaller.');
      return;
    }

    this.isUploadingAvatar.set(true);
    this.organizationService
      .uploadTeamAvatar(this.organization().id, teamId, file)
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.teams.update((items) => items.map((t) => (t.id === updated.id ? updated : t)));
          this.successFlash.show('Team photo updated.');
        },
        error: (err: unknown) =>
          this.avatarError.set(organizationApiErrorMessage(err, 'Failed to upload team avatar.')),
      });
  }

  removeTeamAvatar(): void {
    const teamId = this.detailsTeamId();
    if (!teamId || !this.canManage() || this.isUploadingAvatar()) {
      return;
    }

    this.avatarError.set(null);
    this.isUploadingAvatar.set(true);
    this.organizationService
      .deleteTeamAvatar(this.organization().id, teamId)
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.teams.update((items) => items.map((t) => (t.id === updated.id ? updated : t)));
          this.successFlash.show('Team photo removed.');
        },
        error: (err: unknown) =>
          this.avatarError.set(organizationApiErrorMessage(err, 'Failed to remove team avatar.')),
      });
  }

  startEditMember(member: TeamMember): void {
    this.editingMemberUserId.set(member.userId);
    this.editMemberForm.patchValue({
      roleId: member.roleId,
      jobTitle: member.jobTitle ?? '',
    });
  }

  cancelEditMember(): void {
    this.editingMemberUserId.set(null);
  }

  saveTeamMember(member: TeamMember): void {
    const teamId = this.detailsTeamId();
    if (!teamId || !this.canManage() || this.isSavingMember()) {
      return;
    }

    if (this.editMemberForm.invalid) {
      this.editMemberForm.markAllAsTouched();
      return;
    }

    const { roleId, jobTitle } = this.editMemberForm.getRawValue();
    this.actionError.set(null);
    this.successFlash.clear();
    this.isSavingMember.set(true);

    this.organizationService
      .updateTeamMember(this.organization().id, teamId, member.userId, {
        roleId,
        jobTitle: jobTitle.trim() || null,
      })
      .pipe(
        finalize(() => this.isSavingMember.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.detailsMembers.update((items) =>
            items.map((m) => (m.userId === updated.userId ? updated : m)),
          );
          this.editingMemberUserId.set(null);
          this.successFlash.show('Team member updated.');
        },
        error: (err: unknown) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to update team member.')),
      });
  }

  deleteTeam(team: Team): void {
    if (!this.canManage() || !confirm(`Delete team "${team.name}"?`)) {
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();

    this.organizationService
      .deleteTeam(this.organization().id, team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.teams.update((items) => items.filter((t) => t.id !== team.id));
          if (this.detailsTeamId() === team.id) {
            this.closeDetails();
          }
          this.successFlash.show('Team deleted.');
        },
        error: (err: unknown) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to delete team.')),
      });
  }

  onMemberSearchInput(value: string): void {
    this.memberSearchQuery.set(value);
    this.selectedUser.set(null);
    this.actionError.set(null);

    const trimmed = value.trim();
    if (!trimmed) {
      this.clearMemberSearchResults();
      return;
    }

    this.searchRequests.next(trimmed);
  }

  onMemberSearchFocus(): void {
    if (this.filteredMemberResults().length > 0 || this.memberSearchError()) {
      this.memberDropdownOpen.set(true);
    }
  }

  selectMemberUser(user: UserResponse): void {
    this.selectedUser.set(user);
    this.memberSearchQuery.set(`${user.name} ${user.surname}`.trim());
    this.clearMemberSearchResults();
  }

  clearMemberSelection(): void {
    this.selectedUser.set(null);
    this.memberSearchQuery.set('');
    this.clearMemberSearchResults();
  }

  addTeamMember(): void {
    const teamId = this.detailsTeamId();
    const user = this.selectedUser();
    if (!teamId || !this.canManage()) {
      return;
    }

    if (!user) {
      this.actionError.set('Select a user to add.');
      return;
    }

    if (this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    const { roleId, jobTitle } = this.addMemberForm.getRawValue();
    this.actionError.set(null);
    this.successFlash.clear();
    this.isAddingMember.set(true);

    this.organizationService
      .addTeamMember(this.organization().id, teamId, {
        userId: user.id,
        roleId,
        jobTitle: jobTitle.trim() || undefined,
      })
      .pipe(
        finalize(() => this.isAddingMember.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (member) => {
          this.detailsMembers.update((items) => [...items, member]);
          this.teams.update((items) =>
            items.map((t) => (t.id === teamId ? { ...t, memberCount: t.memberCount + 1 } : t)),
          );
          this.resetAddMemberForm();
          this.successFlash.show('Member added to team.');
        },
        error: (err: unknown) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to add team member.')),
      });
  }

  removeTeamMember(member: TeamMember): void {
    const teamId = this.detailsTeamId();
    if (!teamId || !this.canManage()) {
      return;
    }

    this.actionError.set(null);
    this.successFlash.clear();

    this.organizationService
      .removeTeamMember(this.organization().id, teamId, member.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.detailsMembers.update((items) => items.filter((m) => m.userId !== member.userId));
          this.teams.update((items) =>
            items.map((t) =>
              t.id === teamId ? { ...t, memberCount: Math.max(0, t.memberCount - 1) } : t,
            ),
          );
          this.successFlash.show('Member removed from team.');
        },
        error: (err: unknown) =>
          this.actionError.set(organizationApiErrorMessage(err, 'Failed to remove team member.')),
      });
  }

  initials(user: UserResponse): string {
    const first = user.name?.trim().charAt(0) ?? '';
    const last = user.surname?.trim().charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  closeAddTeamModal(): void {
    this.showAddTeamModal.set(false);
  }

  onTeamCreated(): void {
    this.showAddTeamModal.set(false);
    this.successFlash.show('Team created.');
    this.load(this.organization().id);
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationService
      .listTeams(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams) => {
          this.teams.set(teams);
          this.isLoading.set(false);
          const detailsId = this.detailsTeamId();
          if (detailsId && !teams.some((t) => t.id === detailsId)) {
            this.closeDetails();
          }
        },
        error: (err: unknown) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load teams.'));
          this.isLoading.set(false);
        },
      });

    this.organizationService
      .listRoles(organizationId, 'TEAM')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.teamRoles.set(roles);
          const defaultRole = this.defaultTeamRoleId();
          if (defaultRole && !this.addMemberForm.controls.roleId.value) {
            this.addMemberForm.patchValue({ roleId: defaultRole });
          }
        },
        error: () => this.teamRoles.set([]),
      });
  }

  private defaultTeamRoleId(): string {
    return this.teamRoles().find((r) => r.name === 'Member')?.id ?? this.teamRoles()[0]?.id ?? '';
  }

  private resetAddMemberForm(): void {
    this.addMemberForm.reset({ roleId: this.defaultTeamRoleId(), jobTitle: '' });
    this.clearMemberSelection();
  }

  private clearMemberSearchResults(): void {
    this.memberSearchResults.set([]);
    this.memberDropdownOpen.set(false);
    this.memberSearchError.set(null);
  }
}
