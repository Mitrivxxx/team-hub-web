import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Organization } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';

@Component({
  selector: 'app-organization-manage',
  imports: [RouterLink],
  templateUrl: './organization-manage.html',
  styleUrl: './organization-manage.scss',
})
export class OrganizationManage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly organization = signal<Organization | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.slug) {
      this.isLoading.set(false);
      this.loadError.set('Organization not found.');
      return;
    }

    this.organizationService.getBySlug(this.slug).subscribe({
      next: (organization) => {
        this.organization.set(organization);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load organization.');
        this.isLoading.set(false);
      },
    });
  }

  displayName(): string {
    return this.organization()?.name ?? this.slug;
  }
}
