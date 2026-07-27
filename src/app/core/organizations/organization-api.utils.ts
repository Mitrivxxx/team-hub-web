import { HttpErrorResponse } from '@angular/common/http';

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
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
