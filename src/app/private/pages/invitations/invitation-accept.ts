import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../core/organizations/organization-api.utils';
import { Invitation } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';

@Component({
  selector: 'app-invitation-accept',
  imports: [RouterLink],
  templateUrl: './invitation-accept.html',
  styleUrl: './invitation-accept.scss',
})
export class InvitationAccept implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invitation = signal<Invitation | null>(null);
  readonly error = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isAccepting = signal(false);
  readonly isRejecting = signal(false);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (!token) {
      this.error.set('Missing invitation token.');
      this.isLoading.set(false);
      return;
    }

    this.organizationService
      .getInvitationByToken(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invitation) => {
          this.invitation.set(invitation);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.error.set(organizationApiErrorMessage(err, 'Invitation not found.'));
          this.isLoading.set(false);
        },
      });
  }

  accept(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (!token || this.isAccepting() || this.isRejecting()) {
      return;
    }

    this.isAccepting.set(true);
    this.error.set(null);
    this.organizationService
      .acceptInvitationByToken(token)
      .pipe(
        finalize(() => this.isAccepting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/app'),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to accept invitation.')),
      });
  }

  reject(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (!token || this.isAccepting() || this.isRejecting()) {
      return;
    }

    if (!confirm('Reject this invitation?')) {
      return;
    }

    this.isRejecting.set(true);
    this.error.set(null);
    this.organizationService
      .rejectInvitationByToken(token)
      .pipe(
        finalize(() => this.isRejecting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/app'),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to reject invitation.')),
      });
  }
}
