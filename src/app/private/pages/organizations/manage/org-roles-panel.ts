import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import { MeMembership, Organization, Role } from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';

@Component({
  selector: 'app-org-roles-panel',
  imports: [],
  templateUrl: './org-roles-panel.html',
  styleUrl: './org-roles-panel.scss',
})
export class OrgRolesPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly orgRoles = signal<Role[]>([]);
  readonly teamRoles = signal<Role[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly canManage = () => this.me().permissions.includes('org.roles.manage');

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id) {
        this.load(org.id);
      }
    });
  }

  private load(organizationId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.organizationService
      .listRoles(organizationId, 'ORG')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => this.orgRoles.set(roles),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to load organization roles.')),
      });

    this.organizationService
      .listRoles(organizationId, 'TEAM')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.teamRoles.set(roles);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Failed to load team roles.'));
          this.isLoading.set(false);
        },
      });
  }
}
