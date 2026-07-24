export type SidebarIcon =
  | 'members'
  | 'organization'
  | 'roles'
  | 'statistic'
  | 'auditLog';

export interface SidebarNavChild {
  id: string;
  label: string;
}

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: SidebarIcon;
  children?: SidebarNavChild[];
}
