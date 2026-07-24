import { computed, Injectable, signal } from '@angular/core';

const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_EXPANDED_WIDTH = 260;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'teamhub.orgManage.sidebarCollapsed';

@Injectable({ providedIn: 'root' })
export class OrgManageLayoutService {
  readonly active = signal(false);
  readonly sidebarCollapsed = signal(true);
  readonly organizationName = signal<string | null>(null);
  readonly organizationSlug = signal<string | null>(null);

  readonly sidebarWidthPx = computed(() =>
    this.sidebarCollapsed() ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
  );

  enter(): void {
    this.active.set(true);
    this.sidebarCollapsed.set(this.readCollapsedPreference());
  }

  leave(): void {
    this.active.set(false);
    this.organizationName.set(null);
    this.organizationSlug.set(null);
    this.sidebarCollapsed.set(true);
  }

  setOrganizationContext(name: string, slug: string): void {
    this.organizationName.set(name);
    this.organizationSlug.set(slug);
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    this.writeCollapsedPreference(collapsed);
  }

  private readCollapsedPreference(): boolean {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (raw === null) {
        return true;
      }
      return raw === 'true';
    } catch {
      return true;
    }
  }

  private writeCollapsedPreference(collapsed: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }
}
