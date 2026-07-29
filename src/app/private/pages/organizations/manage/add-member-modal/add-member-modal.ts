import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../../core/organizations/organization-api.utils';
import { RoleListItem } from '../../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../../core/organizations/organization.service';

@Component({
  selector: 'app-add-member-modal',
  imports: [FormsModule],
  templateUrl: './add-member-modal.html',
  styleUrl: './add-member-modal.scss',
})
export class AddMemberModal {
  private readonly organizationService = inject(OrganizationService);

  readonly organizationId = input.required<string>();
  readonly orgRoles = input.required<RoleListItem[]>();

  readonly closed = output<void>();
  readonly added = output<void>();

  readonly userId = signal('');
  readonly roleId = signal('');
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

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

  submit(): void {
    const userId = this.userId().trim();
    const roleId = this.roleId().trim();

    if (!userId || !roleId) {
      this.submitError.set('User ID and role are required.');
      return;
    }

    this.submitError.set(null);
    this.isSubmitting.set(true);

    this.organizationService
      .addMember(this.organizationId(), { userId, roleIds: [roleId] })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.userId.set('');
          this.roleId.set('');
          this.added.emit();
        },
        error: (err: unknown) =>
          this.submitError.set(organizationApiErrorMessage(err, 'Failed to add member.')),
      });
  }
}
