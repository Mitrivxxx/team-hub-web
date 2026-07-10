import { HttpErrorResponse } from '@angular/common/http';

export type FieldValidationErrors = Record<string, string[]>;

export class AuthValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: FieldValidationErrors,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

export function parseApiFieldErrors(error: unknown): FieldValidationErrors | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error;
  if (!body || typeof body !== 'object' || !('errors' in body)) {
    return null;
  }

  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') {
    return null;
  }

  const fieldErrors: FieldValidationErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (!Array.isArray(messages)) {
      continue;
    }

    const normalized = messages.filter((message): message is string => typeof message === 'string');
    if (normalized.length > 0) {
      fieldErrors[field] = normalized;
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}
