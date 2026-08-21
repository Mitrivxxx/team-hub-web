import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';

import { Organization } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';

@Component({
  selector: 'app-organization-placeholder',
  imports: [RouterLink],
  templateUrl: './organization-placeholder.html',
  styleUrl: './organization-placeholder.scss',
})
export class OrganizationPlaceholder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  slug = '';
  readonly organization = signal<Organization | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.slug = params.get('slug') ?? '';
          this.organization.set(null);
          this.loadError.set(null);

          if (!this.slug) {
            this.isLoading.set(false);
            this.loadError.set('Organization not found.');
            return of(null);
          }

          this.isLoading.set(true);
          return this.organizationService.getBySlug(this.slug).pipe(
            catchError(() => {
              this.loadError.set('Failed to load organization.');
              this.isLoading.set(false);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((organization) => {
        if (!organization) {
          return;
        }

        this.organization.set(organization);
        this.isLoading.set(false);
      });
  }

  displayName(): string {
    return this.organization()?.name ?? this.slug;
  }
}
