import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SidebarNavItem } from './sidebar.model';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: {
    '[class.sidebar-host--expanded]': '!isCollapsed()',
  },
})
export class Sidebar {
  readonly items = input.required<SidebarNavItem[]>();
  readonly activeId = input.required<string>();
  readonly collapsed = input(true);
  readonly homeLink = input('/app');

  readonly itemSelect = output<string>();
  readonly collapsedChange = output<boolean>();

  private readonly collapsedState = linkedSignal(() => this.collapsed());
  readonly isCollapsed = computed(() => this.collapsedState());

  /** Explicitly opened/closed by user; active branch still shows as open via isBranchOpen. */
  private readonly forcedOpenIds = signal<Set<string>>(new Set());
  private readonly forcedClosedIds = signal<Set<string>>(new Set());

  toggleCollapsed(): void {
    const next = !this.collapsedState();
    this.collapsedState.set(next);
    this.collapsedChange.emit(next);
  }

  isBranchOpen(id: string): boolean {
    if (this.forcedClosedIds().has(id)) {
      return false;
    }
    if (this.forcedOpenIds().has(id)) {
      return true;
    }
    return this.isActiveBranch(id);
  }

  isActiveBranch(id: string): boolean {
    const item = this.items().find((entry) => entry.id === id);
    if (!item) {
      return false;
    }
    if (this.activeId() === item.id) {
      return true;
    }
    return item.children?.some((child) => child.id === this.activeId()) ?? false;
  }

  isChildActive(id: string): boolean {
    return this.activeId() === id;
  }

  hasActiveChild(item: SidebarNavItem): boolean {
    return item.children?.some((child) => child.id === this.activeId()) ?? false;
  }

  onMainSelect(item: SidebarNavItem): void {
    const children = item.children ?? [];

    if (children.length === 0) {
      if (this.isCollapsed()) {
        this.collapsedState.set(false);
        this.collapsedChange.emit(false);
      }
      this.itemSelect.emit(item.id);
      return;
    }

    if (this.isCollapsed()) {
      this.collapsedState.set(false);
      this.collapsedChange.emit(false);
      this.openBranch(item.id);
      if (!this.hasActiveChild(item)) {
        this.itemSelect.emit(children[0].id);
      }
      return;
    }

    // Expanded: toggle branch only; keep active child.
    if (this.isBranchOpen(item.id)) {
      this.closeBranch(item.id);
    } else {
      this.openBranch(item.id);
    }
  }

  onChildSelect(id: string): void {
    this.itemSelect.emit(id);
  }

  private openBranch(id: string): void {
    this.forcedClosedIds.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    this.forcedOpenIds.update((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  private closeBranch(id: string): void {
    this.forcedOpenIds.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    this.forcedClosedIds.update((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }
}
