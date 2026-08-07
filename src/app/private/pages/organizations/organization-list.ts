import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  clearRecentlyDeletedOrganization,
  organizationApiErrorMessage,
  readRecentlyDeletedOrganization,
} from '../../../core/organizations/organization-api.utils';
import {
  Invitation,
  Organization,
  RecentlyDeletedOrganization,
} from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';
import { CreateOrganizationModal } from '../../components/create-organization-modal/create-organization-modal';

@Component({
  selector: 'app-organization-list',
  imports: [DatePipe, RouterLink, CreateOrganizationModal],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.scss',
})
export class OrganizationList implements OnInit {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly organizations = signal<Organization[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly createModalOpen = signal(false);

  readonly pendingInvitations = signal<Invitation[]>([]);
  readonly invitationsLoading = signal(false);
  readonly invitationsError = signal<string | null>(null);

  readonly recentlyDeleted = signal<RecentlyDeletedOrganization | null>(null);
  readonly isRestoring = signal(false);
  readonly restoreError = signal<string | null>(null);

  ngOnInit(): void {
    this.recentlyDeleted.set(readRecentlyDeletedOrganization());
    this.loadOrganizations();
    this.loadPendingInvitations();
  }

  openCreateModal(): void {
    this.createModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.createModalOpen.set(false);
  }

  onOrganizationCreated(organization: Organization): void {
    this.organizations.update((items) => [...items, organization].sort((a, b) => a.name.localeCompare(b.name)));
    this.createModalOpen.set(false);
  }

  retryLoad(): void {
    this.loadOrganizations();
  }

  dismissRecentlyDeleted(): void {
    clearRecentlyDeletedOrganization();
    this.recentlyDeleted.set(null);
    this.restoreError.set(null);
  }

  restoreOrganization(): void {
    const deleted = this.recentlyDeleted();
    if (!deleted || this.isRestoring()) {
      return;
    }

    this.isRestoring.set(true);
    this.restoreError.set(null);

    this.organizationService
      .restore(deleted.orgId)
      .pipe(
        finalize(() => this.isRestoring.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (organization) => {
          clearRecentlyDeletedOrganization();
          this.recentlyDeleted.set(null);
          this.organizations.update((items) =>
            [...items, organization].sort((a, b) => a.name.localeCompare(b.name)),
          );
        },
        error: (err) => {
          this.restoreError.set(organizationApiErrorMessage(err, 'Failed to restore organization.'));
          if (err instanceof HttpErrorResponse && (err.status === 410 || err.status === 404)) {
            clearRecentlyDeletedOrganization();
            this.recentlyDeleted.set(null);
          }
        },
      });
  }

  private loadOrganizations(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.organizationService.list().subscribe({
      next: (organizations) => {
        this.organizations.set(organizations);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load organizations. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  private loadPendingInvitations(): void {
    this.invitationsLoading.set(true);
    this.invitationsError.set(null);

    this.organizationService
      .listMyInvitations()
      .pipe(
        finalize(() => this.invitationsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invitations) => this.pendingInvitations.set(invitations),
        error: (err) =>
          this.invitationsError.set(
            organizationApiErrorMessage(err, 'Failed to load pending invitations.'),
          ),
      });
  }
}
