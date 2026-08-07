import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  organizationApiErrorMessage,
  saveRecentlyDeletedOrganization,
} from '../../../../core/organizations/organization-api.utils';
import { OrganizationGraphqlService } from '../../../../core/organizations/organization-graphql.service';
import {
  MeMembership,
  Member,
  Organization,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Component({
  selector: 'app-org-settings-panel',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './org-settings-panel.html',
  styleUrl: './org-settings-panel.scss',
})
export class OrgSettingsPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly organizationGraphql = inject(OrganizationGraphqlService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly organizationUpdated = output<Organization>();

  readonly isSaving = signal(false);
  readonly isSavingStatus = signal(false);
  readonly isLeaving = signal(false);
  readonly isDeleting = signal(false);
  readonly isTransferring = signal(false);
  readonly isUploadingAvatar = signal(false);
  readonly isLoadingMembers = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = this.successFlash.message;
  readonly avatarError = signal<string | null>(null);
  readonly transferError = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);

  readonly members = signal<Member[]>([]);
  readonly transferUserId = signal('');
  readonly statusDraft = signal<'active' | 'suspended' | 'archived'>('active');

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    nip: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    country: ['', [Validators.required, Validators.maxLength(100)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    postalCode: ['', [Validators.required, Validators.maxLength(20)]],
  });

  constructor() {
    effect(() => {
      const org = this.organization();
      const canManage = this.me().permissions.includes('org.manage');

      this.form.patchValue(
        {
          name: org.name,
          description: org.description ?? '',
          nip: org.nip ?? '',
          country: org.address?.country ?? '',
          city: org.address?.city ?? '',
          postalCode: org.address?.postalCode ?? '',
        },
        { emitEvent: false },
      );
      this.form.markAsPristine();

      const status = (org.status ?? 'active').toLowerCase();
      if (status === 'suspended' || status === 'archived' || status === 'active') {
        this.statusDraft.set(status);
      } else {
        this.statusDraft.set('active');
      }

      if (canManage) {
        this.form.enable({ emitEvent: false });
      } else {
        this.form.disable({ emitEvent: false });
      }
    });

    effect(() => {
      const org = this.organization();
      if (org?.id && this.isOwner()) {
        this.loadMembers(org.id);
      }
    });
  }

  canManage(): boolean {
    return this.me().permissions.includes('org.manage');
  }

  canDelete(): boolean {
    return this.me().permissions.includes('org.delete');
  }

  isOwner(): boolean {
    return this.me().roles.some((role) => role.name === 'Owner' && role.scope === 'ORG');
  }

  transferCandidates(): Member[] {
    const currentUserId = this.me().userId;
    return this.members().filter((member) => member.userId !== currentUserId);
  }

  memberLabel(member: Member): string {
    const user = member.user;
    if (user) {
      const fullName = `${user.name} ${user.surname}`.trim();
      return fullName ? `${fullName} (@${user.username})` : user.username;
    }
    return member.userId;
  }

  initials(): string {
    const name = this.organization().name.trim();
    if (!name) {
      return '?';
    }

    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }

  save(): void {
    if (!this.canManage() || this.isSaving()) {
      return;
    }

    this.error.set(null);
    this.successFlash.clear();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, nip, country, city, postalCode } = this.form.getRawValue();
    this.isSaving.set(true);

    this.organizationService
      .update(this.organization().id, {
        name: name.trim(),
        description: description.trim() || null,
        nip: nip.trim(),
        address: {
          country: country.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
        },
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.organizationUpdated.emit(updated);
          this.successFlash.show('Organization details saved.');
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to update organization.')),
      });
  }

  saveStatus(): void {
    if (!this.canManage() || this.isSavingStatus()) {
      return;
    }

    const status = this.statusDraft();
    if (status === (this.organization().status ?? 'active').toLowerCase()) {
      return;
    }

    this.statusError.set(null);
    this.successFlash.clear();
    this.isSavingStatus.set(true);

    this.organizationService
      .updateStatus(this.organization().id, { status })
      .pipe(
        finalize(() => this.isSavingStatus.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.organizationUpdated.emit(updated);
          this.successFlash.show('Organization status updated.');
        },
        error: (err) =>
          this.statusError.set(organizationApiErrorMessage(err, 'Failed to update status.')),
      });
  }

  discard(): void {
    const org = this.organization();
    this.form.patchValue({
      name: org.name,
      description: org.description ?? '',
      nip: org.nip ?? '',
      country: org.address?.country ?? '',
      city: org.address?.city ?? '',
      postalCode: org.address?.postalCode ?? '',
    });
    this.form.markAsPristine();
    this.error.set(null);
  }

  onAvatarSelected(event: Event): void {
    if (!this.canManage() || this.isUploadingAvatar()) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.avatarError.set(null);

    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      this.avatarError.set('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      this.avatarError.set('Image must be 2 MB or smaller.');
      return;
    }

    this.isUploadingAvatar.set(true);
    this.organizationService
      .uploadAvatar(this.organization().id, file)
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.organizationUpdated.emit(updated);
          this.successFlash.show('Organization photo updated.');
        },
        error: (err) => this.avatarError.set(organizationApiErrorMessage(err, 'Failed to upload avatar.')),
      });
  }

  removeAvatar(): void {
    if (!this.canManage() || this.isUploadingAvatar()) {
      return;
    }

    this.avatarError.set(null);
    this.isUploadingAvatar.set(true);
    this.organizationService
      .deleteAvatar(this.organization().id)
      .pipe(
        finalize(() => this.isUploadingAvatar.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.organizationUpdated.emit(updated);
          this.successFlash.show('Organization photo removed.');
        },
        error: (err) => this.avatarError.set(organizationApiErrorMessage(err, 'Failed to remove avatar.')),
      });
  }

  transferOwnership(): void {
    if (!this.isOwner() || this.isTransferring()) {
      return;
    }

    const newOwnerUserId = this.transferUserId().trim();
    if (!newOwnerUserId) {
      this.transferError.set('Select a member to transfer ownership to.');
      return;
    }

    if (
      !confirm(
        'Transfer ownership to the selected member? You will lose owner privileges.',
      )
    ) {
      return;
    }

    this.transferError.set(null);
    this.isTransferring.set(true);

    this.organizationService
      .transferOwnership(this.organization().id, { newOwnerUserId })
      .pipe(
        finalize(() => this.isTransferring.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.successFlash.show('Ownership transferred.');
          this.transferUserId.set('');
          window.location.reload();
        },
        error: (err) =>
          this.transferError.set(organizationApiErrorMessage(err, 'Failed to transfer ownership.')),
      });
  }

  leaveOrganization(): void {
    if (!confirm('Leave this organization?')) {
      return;
    }

    this.isLeaving.set(true);
    this.error.set(null);

    this.organizationService
      .leave(this.organization().id)
      .pipe(
        finalize(() => this.isLeaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/app']),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to leave organization.')),
      });
  }

  deleteOrganization(): void {
    if (!this.canDelete()) {
      return;
    }

    if (
      !confirm(
        'Soft-delete this organization? You can restore it from the organizations list within the retention window.',
      )
    ) {
      return;
    }

    this.isDeleting.set(true);
    this.error.set(null);

    const org = this.organization();
    this.organizationService
      .delete(org.id)
      .pipe(
        finalize(() => this.isDeleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          saveRecentlyDeletedOrganization({
            orgId: org.id,
            name: org.name,
            deletedAt: new Date().toISOString(),
          });
          void this.router.navigate(['/app']);
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to delete organization.')),
      });
  }

  private loadMembers(organizationId: string): void {
    this.isLoadingMembers.set(true);
    this.organizationGraphql
      .listMembers(organizationId)
      .pipe(
        finalize(() => this.isLoadingMembers.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (members) => this.members.set(members),
        error: () => this.members.set([]),
      });
  }
}
