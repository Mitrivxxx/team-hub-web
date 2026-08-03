import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { filter, finalize, switchMap, take, timer } from 'rxjs';

import { organizationApiErrorMessage } from '../../../../core/organizations/organization-api.utils';
import {
  CreateExportRequest,
  ImportExportJob,
  ImportPreviewResponse,
  MeMembership,
  Organization,
} from '../../../../core/organizations/organization.model';
import { OrganizationService } from '../../../../core/organizations/organization.service';
import { createFlashMessage } from '../../../../shared/flash-message';

@Component({
  selector: 'app-org-import-export-panel',
  imports: [DatePipe, FormsModule],
  templateUrl: './org-import-export-panel.html',
  styleUrl: './org-import-export-panel.scss',
})
export class OrgImportExportPanel {
  private readonly organizationService = inject(OrganizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly successFlash = createFlashMessage(this.destroyRef);

  readonly organization = input.required<Organization>();
  readonly me = input.required<MeMembership>();

  readonly canManage = () => this.me().permissions.includes('org.members.manage');

  readonly activeSection = signal<'import' | 'export' | 'history'>('import');
  readonly jobs = signal<ImportExportJob[]>([]);
  readonly isLoadingJobs = signal(false);
  readonly isPreviewing = signal(false);
  readonly isImporting = signal(false);
  readonly isExporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = this.successFlash.message;

  readonly preview = signal<ImportPreviewResponse | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly activeJob = signal<ImportExportJob | null>(null);

  readonly exportFormat = signal<'csv' | 'json'>('csv');
  readonly datasetOptions = [
    { id: 'members', label: 'Members' },
    { id: 'teams', label: 'Teams' },
    { id: 'roles', label: 'Roles' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'organization', label: 'Organization' },
  ] as const;
  readonly exportDatasets = signal<Record<string, boolean>>({
    members: true,
    teams: true,
    roles: true,
    permissions: true,
    organization: true,
  });
  readonly allDatasetsSelected = computed(() =>
    this.datasetOptions.every((opt) => this.exportDatasets()[opt.id]),
  );

  constructor() {
    effect(() => {
      const org = this.organization();
      if (org?.id && this.canManage()) {
        this.loadJobs(org.id);
      }
    });
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.preview.set(null);
    this.activeJob.set(null);
    this.error.set(null);
  }

  downloadTemplate(): void {
    const csv =
      'email,username,org_roles,team,team_role,job_title\n' +
      'user@example.com,,Member,Engineering,Member,Developer\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'member-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  previewImport(): void {
    if (!this.canManage() || this.isPreviewing()) return;
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Select a CSV file first.');
      return;
    }

    this.error.set(null);
    this.successFlash.clear();
    this.isPreviewing.set(true);

    this.organizationService
      .previewImport(this.organization().id, file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isPreviewing.set(false)),
      )
      .subscribe({
        next: (result) => this.preview.set(result),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Preview failed.')),
      });
  }

  confirmImport(): void {
    if (!this.canManage() || this.isImporting()) return;
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Select a CSV file first.');
      return;
    }

    this.error.set(null);
    this.successFlash.clear();
    this.isImporting.set(true);

    this.organizationService
      .startImport(this.organization().id, file)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((accepted) => this.pollJob(accepted.jobId)),
        finalize(() => this.isImporting.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.activeJob.set(job);
          this.loadJobs(this.organization().id);
          if (job.status === 'completed') {
            this.successFlash.show(`Import completed: ${job.successCount} rows.`);
          } else if (job.status === 'completed_with_errors') {
            this.successFlash.show(
              `Import finished with errors: ${job.successCount} ok, ${job.errorCount} failed.`,
            );
          } else if (job.status === 'failed') {
            this.error.set(job.errorMessage ?? 'Import failed.');
          }
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Import failed.')),
      });
  }

  startExport(): void {
    if (!this.canManage() || this.isExporting()) return;

    const datasets = Object.entries(this.exportDatasets())
      .filter(([, enabled]) => enabled)
      .map(([id]) => id);

    if (datasets.length === 0) {
      this.error.set('Select at least one dataset.');
      return;
    }

    this.error.set(null);
    this.successFlash.clear();
    this.isExporting.set(true);

    const request: CreateExportRequest = {
      format: this.exportFormat(),
      datasets,
    };

    this.organizationService
      .startExport(this.organization().id, request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((accepted) => this.pollJob(accepted.jobId)),
        finalize(() => this.isExporting.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.activeJob.set(job);
          this.loadJobs(this.organization().id);
          if (job.status === 'completed' || job.status === 'completed_with_errors') {
            this.successFlash.show('Export ready.');
            this.downloadArtifact(job.id, 'result');
          } else if (job.status === 'failed') {
            this.error.set(job.errorMessage ?? 'Export failed.');
          }
        },
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Export failed.')),
      });
  }

  toggleDataset(id: string, checked: boolean): void {
    this.exportDatasets.update((current) => ({ ...current, [id]: checked }));
  }

  toggleAllDatasets(checked: boolean): void {
    this.exportDatasets.update((current) => {
      const next = { ...current };
      for (const opt of this.datasetOptions) {
        next[opt.id] = checked;
      }
      return next;
    });
  }

  downloadArtifact(jobId: string, artifact: 'result' | 'errors' | 'source'): void {
    const org = this.organization();
    const ext = this.activeJob()?.format === 'json' || this.jobs().find((j) => j.id === jobId)?.format === 'json'
      ? 'json'
      : 'csv';
    const fileName =
      artifact === 'result'
        ? `${org.slug || org.name}.${ext}`
        : artifact === 'errors'
          ? `${org.slug || org.name}-errors.csv`
          : `${org.slug || org.name}-source.csv`;

    this.organizationService
      .getImportExportDownload(org.id, jobId, artifact)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.saveUrlAsFile(res.url, fileName),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Download failed.')),
      });
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ');
  }

  rowErrorText(errors: { message: string }[]): string {
    return errors.map((e) => e.message).join('; ');
  }

  private saveUrlAsFile(url: string, fileName: string): void {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Download failed (${response.status})`);
        }
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        // Fallback when blob CORS blocks fetch (still may use blob path name).
        window.open(url, '_blank', 'noopener');
      });
  }

  private loadJobs(organizationId: string): void {
    this.isLoadingJobs.set(true);
    this.organizationService
      .listImportExportJobs(organizationId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingJobs.set(false)),
      )
      .subscribe({
        next: (jobs) => this.jobs.set(jobs),
        error: (err) => this.error.set(organizationApiErrorMessage(err, 'Failed to load job history.')),
      });
  }

  private pollJob(jobId: string) {
    return timer(0, 1500).pipe(
      switchMap(() => this.organizationService.getImportExportJob(this.organization().id, jobId)),
      filter((job) => {
        this.activeJob.set(job);
        return job.status !== 'queued' && job.status !== 'running';
      }),
      take(1),
    );
  }
}
