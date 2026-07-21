import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Organization } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';
import { CreateOrganizationModal } from '../../components/create-organization-modal/create-organization-modal';

@Component({
  selector: 'app-organization-list',
  imports: [RouterLink, CreateOrganizationModal],
  templateUrl: './organization-list.html',
  styleUrl: './organization-list.scss',
})
export class OrganizationList implements OnInit {
  private readonly organizationService = inject(OrganizationService);

  readonly organizations = signal<Organization[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly createModalOpen = signal(false);

  ngOnInit(): void {
    this.loadOrganizations();
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
}
