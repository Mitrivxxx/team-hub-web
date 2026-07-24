import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgManageLayoutService } from '../../../core/layout/org-manage-layout.service';
import { Organization } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';
import { Sidebar } from '../../../shared/sidebar/sidebar';
import { SidebarNavItem } from '../../../shared/sidebar/sidebar.model';

interface ManagePageChrome {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    tabId: string;
  };
}

@Component({
  selector: 'app-organization-manage',
  imports: [RouterLink, Sidebar],
  templateUrl: './organization-manage.html',
  styleUrl: './organization-manage.scss',
})
export class OrganizationManage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly orgManageLayout = inject(OrgManageLayoutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly organization = signal<Organization | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly activeTab = signal('member-list');

  readonly sidebarCollapsed = this.orgManageLayout.sidebarCollapsed;

  readonly navItems: SidebarNavItem[] = [
    {
      id: 'members',
      label: 'Members',
      icon: 'members',
      children: [
        { id: 'member-list', label: 'Member list' },
        { id: 'add-member', label: 'Add member' },
      ],
    },
    {
      id: 'organization',
      label: 'Organization',
      icon: 'organization',
    },
    {
      id: 'roles',
      label: 'Role/Permission',
      icon: 'roles',
      children: [
        { id: 'teams', label: 'Teams' },
        { id: 'role', label: 'Role' },
      ],
    },
    {
      id: 'statistic',
      label: 'Statistic',
      icon: 'statistic',
    },
    {
      id: 'audit-log',
      label: 'Audit Log',
      icon: 'auditLog',
    },
  ];

  private readonly pageChromeByTab: Record<string, ManagePageChrome> = {
    'member-list': {
      title: 'Member list',
      description: 'View and manage people who belong to this organization.',
      primaryAction: { label: 'Add member', tabId: 'add-member' },
    },
    'add-member': {
      title: 'Add member',
      description: 'Invite a new member to this organization.',
    },
    organization: {
      title: 'Organization',
      description: 'General settings and profile for this organization.',
    },
    teams: {
      title: 'Teams',
      description: 'Group members into teams for collaboration and access.',
    },
    role: {
      title: 'Role',
      description: 'Define roles and permissions for organization members.',
    },
    statistic: {
      title: 'Statistic',
      description: 'Usage and activity metrics for this organization.',
    },
    'audit-log': {
      title: 'Audit Log',
      description: 'Review security and administration events.',
    },
  };

  readonly pageChrome = computed(() => {
    const tab = this.activeTab();
    return (
      this.pageChromeByTab[tab] ?? {
        title: tab,
        description: 'Content for this section will be added later.',
      }
    );
  });

  constructor() {
    this.orgManageLayout.enter();
    if (this.slug) {
      this.orgManageLayout.setOrganizationContext(this.slug, this.slug);
    }
    this.destroyRef.onDestroy(() => this.orgManageLayout.leave());
  }

  ngOnInit(): void {
    if (!this.slug) {
      this.isLoading.set(false);
      this.loadError.set('Organization not found.');
      return;
    }

    this.organizationService
      .getBySlug(this.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (organization) => {
          this.organization.set(organization);
          this.orgManageLayout.setOrganizationContext(organization.name, organization.slug || this.slug);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set('Failed to load organization.');
          this.isLoading.set(false);
        },
      });
  }

  onTabSelect(id: string): void {
    this.activeTab.set(id);
  }

  onSidebarCollapsedChange(collapsed: boolean): void {
    this.orgManageLayout.setSidebarCollapsed(collapsed);
  }

  onPrimaryAction(): void {
    const action = this.pageChrome().primaryAction;
    if (action) {
      this.activeTab.set(action.tabId);
    }
  }
}
