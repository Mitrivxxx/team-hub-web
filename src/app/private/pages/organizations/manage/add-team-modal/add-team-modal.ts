import {
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../../core/organizations/organization-api.utils';
import { OrganizationService } from '../../../../../core/organizations/organization.service';

@Component({
  selector: 'app-add-team-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './add-team-modal.html',
  styleUrl: './add-team-modal.scss',
})
export class AddTeamModal {
  private readonly organizationService = inject(OrganizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  readonly organizationId = input.required<string>();

  readonly closed = output<void>();
  readonly created = output<void>();

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    afterNextRender(() => {
      this.nameInput().nativeElement.focus();
    });
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description } = this.form.getRawValue();
    this.submitError.set(null);
    this.isSubmitting.set(true);

    this.organizationService
      .createTeam(this.organizationId(), {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.form.reset({ name: '', description: '' });
          this.created.emit();
        },
        error: (err: unknown) =>
          this.submitError.set(organizationApiErrorMessage(err, 'Failed to create team.')),
      });
  }

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
}
