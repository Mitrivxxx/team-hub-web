import { Injectable } from '@angular/core';

const SESSION_STORAGE_KEY = 'team-hub-session-id';

@Injectable({ providedIn: 'root' })
export class SessionContextService {
  getOrCreate(): string {
    const existing = firstHeaderValue(sessionStorage.getItem(SESSION_STORAGE_KEY));
    if (existing) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, existing);
      return existing;
    }

    const sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  }

  syncFromResponse(header: string | null): void {
    const sessionId = firstHeaderValue(header);
    if (!sessionId) {
      return;
    }

    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
}

export function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const token = value.split(',')[0].trim();
  return token.length > 0 ? token : null;
}
