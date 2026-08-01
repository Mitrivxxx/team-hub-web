import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrgManageLayoutService } from '../../../core/layout/org-manage-layout.service';
import { MeMembership, Organization } from '../../../core/organizations/organization.model';
import { OrganizationService } from '../../../core/organizations/organization.service';
import { Sidebar } from '../../../shared/sidebar/sidebar';
import { SidebarNavItem } from '../../../shared/sidebar/sidebar.model';
import { OrgAddMemberPanel } from './manage/org-add-member-panel';
import { OrgAuditLogPanel } from './manage/org-audit-log-panel';
import { OrgMemberListPanel } from './manage/org-member-list-panel';
import { OrgPermissionsPanel } from './manage/org-permissions-panel';
import { OrgRolesPanel } from './manage/org-roles-panel';
import { OrgSettingsPanel } from './manage/org-settings-panel';
import { OrgTeamsPanel } from './manage/org-teams-panel';

interface ManagePageChrome {
  title: string;
  primaryAction?: {
    label: string;
    action: 'add-member' | 'add-team';
  };
}

@Component({
  selector: 'app-organization-manage',
  imports: [
    RouterLink,
    Sidebar,
    OrgMemberListPanel,
    OrgAddMemberPanel,
    OrgAuditLogPanel,
    OrgSettingsPanel,
    OrgTeamsPanel,
    OrgRolesPanel,
    OrgPermissionsPanel,
  ],
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
  readonly me = signal<MeMembership | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly activeTab = signal('all-members');
  readonly addMemberRequest = signal(0);
  readonly addTeamRequest = signal(0);

  readonly sidebarCollapsed = this.orgManageLayout.sidebarCollapsed;

  readonly navItems: SidebarNavItem[] = [
    {
      id: 'members',
      label: 'Members',
      icon: 'members',
      children: [
        { id: 'all-members', label: 'All Members' },
        { id: 'invitations', label: 'Invitations' },
        { id: 'activity', label: 'Activity' },
        { id: 'import-export', label: 'Import / Export' },
      ],
    },
    {
      id: 'organization',
      label: 'Organization',
      icon: 'organization',
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: 'teams',
    },
    {
      id: 'roles',
      label: 'Role/Permission',
      icon: 'roles',
      children: [
        { id: 'member-roles', label: 'Roles' },
        { id: 'permissions', label: 'Permissions' },
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
    'all-members': {
      title: 'All Members',
      primaryAction: { label: '+ Add Member', action: 'add-member' },
    },
    invitations: { title: 'Invitations' },
    'member-roles': { title: 'Roles' },
    permissions: { title: 'Permissions' },
    activity: { title: 'Activity' },
    'import-export': { title: 'Import / Export' },
    organization: { title: 'Organization' },
    teams: {
      title: 'Teams',
      primaryAction: { label: '+ Add Team', action: 'add-team' },
    },
    statistic: { title: 'Statistic' },
    'audit-log': { title: 'Audit Log' },
  };

  readonly pageChrome = computed(() => {
    const tab = this.activeTab();
    return this.pageChromeByTab[tab] ?? { title: tab };
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
          this.loadMembership(organization.id);
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
    if (action?.action === 'add-member') {
      this.addMemberRequest.update((n) => n + 1);
    } else if (action?.action === 'add-team') {
      this.addTeamRequest.update((n) => n + 1);
    }
  }

  onOrganizationUpdated(organization: Organization): void {
    this.organization.set(organization);
    this.orgManageLayout.setOrganizationContext(organization.name, organization.slug || this.slug);
  }

  private loadMembership(organizationId: string): void {
    this.organizationService
      .getMe(organizationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (membership) => {
          this.me.set(membership);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set('Failed to load organization membership.');
          this.isLoading.set(false);
        },
      });
  }
}
