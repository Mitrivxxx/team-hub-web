import { HttpErrorResponse } from '@angular/common/http';

import { RecentlyDeletedOrganization } from './organization.model';

const RECENTLY_DELETED_KEY = 'teamhub.org.recentlyDeleted';
const RECENTLY_DELETED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function organizationApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: string } | null)?.detail;
    if (detail) {
      return detail;
    }
    if (error.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.status === 404) {
      return 'Resource was not found.';
    }
    if (error.status === 409) {
      return 'This action conflicts with the current state.';
    }
    if (error.status === 410) {
      return 'This resource is no longer available.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function saveRecentlyDeletedOrganization(entry: RecentlyDeletedOrganization): void {
  try {
    sessionStorage.setItem(RECENTLY_DELETED_KEY, JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

export function readRecentlyDeletedOrganization(): RecentlyDeletedOrganization | null {
  try {
    const raw = sessionStorage.getItem(RECENTLY_DELETED_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as RecentlyDeletedOrganization;
    if (!parsed?.orgId || !parsed?.deletedAt) {
      clearRecentlyDeletedOrganization();
      return null;
    }
    const deletedAt = Date.parse(parsed.deletedAt);
    if (Number.isNaN(deletedAt) || Date.now() - deletedAt > RECENTLY_DELETED_RETENTION_MS) {
      clearRecentlyDeletedOrganization();
      return null;
    }
    return parsed;
  } catch {
    clearRecentlyDeletedOrganization();
    return null;
  }
}

export function clearRecentlyDeletedOrganization(): void {
  try {
    sessionStorage.removeItem(RECENTLY_DELETED_KEY);
  } catch {
    // ignore storage failures
  }
}
