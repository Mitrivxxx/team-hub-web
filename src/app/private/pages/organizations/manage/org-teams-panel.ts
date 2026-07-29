import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import { MeMembership, Organization, Role, Team, TeamMember } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

@Component({
  selector: 'app-org-teams-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './org-teams-panel.html',
  styleUrl: './org-teams-panel.scss',
})
export class OrgTeamsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly teams = signal<Team[]>([]);
  readonly teamRoles = signal<Role[]>([]);
  readonly members = signal<TeamMember[]>([]);
  readonly selectedTeamId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isCreating = signal(false);
  readonly error = signal<string | null>(null);

  readonly canManage = () => this.me().permissions.includes('org.teams.manage');

  readonly createForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  readonly addMemberForm = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    roleId: ['', Validators.required],
    jobTitle: ['', Validators.maxLength(100)],
  });

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.loadTeams(org.id);
      }
    });
  }

  selectTeam(teamId: string): void {
    this.selectedTeamId.set(teamId);
    this.loadTeamMembers(teamId);
  }

  createTeam(): void {
    if (!this.canManage() || this.isCreating()) {
      return;
    }

    this.error.set(null);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { name, description } = this.createForm.getRawValue();
    this.isCreating.set(true);

    this.organizationService
      .createTeam(this.organization().id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      .pipe(
        finalize(() => this.isCreating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (team) => {
          this.teams.update((items) => [...items, team].sort((a, b) => a.name.localeCompare(b.name)));
          this.createForm.reset({ name: '', description: '' });
          this.selectTeam(team.id);
        },
        error: (err: unknown) => this.error.set(organizationApiErrorMessage(err, 'Failed to create team.')),
      });
  }

  deleteTeam(team: Team): void {
    if (!this.canManage() || !confirm(`Delete team "${team.name}"?`)) {
      return;
    }

    this.organizationService
      .deleteTeam(this.organization().id, team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.teams.update((items) => items.filter((t) => t.id !== team.id));
          if (this.selectedTeamId() === team.id) {
            this.selectedTeamId.set(null);
            this.members.set([]);
          }
        },
        error: (err: unknown) => this.error.set(organizationApiErrorMessage(err, 'Failed to delete team.')),
      });
  }

  addTeamMember(): void {
    const teamId = this.selectedTeamId();
    if (!teamId || !this.canManage() || this.addMemberForm.invalid) {
      this.addMemberForm.markAllAsTouched();
      return;
    }

    const { userId, roleId, jobTitle } = this.addMemberForm.getRawValue();

    this.organizationService
      .addTeamMember(this.organization().id, teamId, {
        userId: userId.trim(),
        roleId,
        jobTitle: jobTitle.trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (member: TeamMember) => {
          this.members.update((items) => [...items, member]);
          this.addMemberForm.reset({ userId: '', roleId: this.defaultTeamRoleId(), jobTitle: '' });
        },
        error: (err: unknown) => this.error.set(organizationApiErrorMessage(err, 'Failed to add team member.')),
      });
  }

  removeTeamMember(member: TeamMember): void {
    const teamId = this.selectedTeamId();
    if (!teamId || !this.canManage()) {
      return;
    }

    this.organizationService
      .removeTeamMember(this.organization().id, teamId, member.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.members.update((items) => items.filter((m) => m.userId !== member.userId)),
        error: (err: unknown) => this.error.set(organizationApiErrorMessage(err, 'Failed to remove team member.')),
      });
  }

  selectedTeam(): Team | null {
    const id = this.selectedTeamId();
    return this.teams().find((t) => t.id === id) ?? null;
  }

  private loadTeams(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationService
      .listTeams(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams: Team[]) => {
          this.teams.set(teams);
          this.isLoading.set(false);
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
          if (defaultRole) {
            this.addMemberForm.patchValue({ roleId: defaultRole });
          }
        },
        error: () => this.teamRoles.set([]),
      });
  }

  private loadTeamMembers(teamId: string): void {
    this.organizationService
      .listTeamMembers(this.organization().id, teamId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members: TeamMember[]) => this.members.set(members),
        error: (err: unknown) => this.error.set(organizationApiErrorMessage(err, 'Failed to load team members.')),
      });
  }

  private defaultTeamRoleId(): string {
    return this.teamRoles().find((r) => r.name === 'Member')?.id ?? this.teamRoles()[0]?.id ?? '';
  }
}
