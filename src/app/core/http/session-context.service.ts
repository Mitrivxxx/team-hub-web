import { Injectable } from '@angular/core';

const SESSION_STORAGE_KEY = 'team-hub-session-id';

@Injectable({ providedIn: 'root' })
export class SessionContextService {
  getOrCreate(): string {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  }

  syncFromResponse(header: string | null): void {
    if (!header) {
      return;
    }

    sessionStorage.setItem(SESSION_STORAGE_KEY, header);
  }
}
