export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
}

export interface CreateOrganizationInput {
  name: string;
  description?: string;
  avatar?: File;
}

export interface CreateOrganizationResult {
  organization: Organization;
  avatarUploadFailed: boolean;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string | null;
}

export interface TransferOwnershipRequest {
  newOwnerUserId: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  scope: 'ORG' | 'TEAM' | string;
  isSystem: boolean;
}

export interface PermissionSummary {
  id: string;
  name: string;
  code: string;
  isSystem: boolean;
}

export interface MemberSummary {
  userId: string;
  joinedAt: string;
}

export interface Member {
  userId: string;
  roles: RoleSummary[];
  joinedAt: string;
  teamIds: string[];
  user?: MemberUser | null;
}

export interface MemberUser {
  id?: string;
  username: string;
  name: string;
  surname: string;
}

export interface AddMemberRequest {
  userId: string;
  roleIds: string[];
}

export interface UpdateMemberRequest {
  roleIds: string[];
}

export interface TeamMembership {
  teamId: string;
  teamName: string;
  roleId: string;
  roleName: string;
  jobTitle: string | null;
  joinedAt: string;
}

export interface PermissionListItem {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  roleCount: number;
}

export interface PermissionDetail {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  roleCount: number;
  roles: RoleSummary[];
}

export interface CreatePermissionRequest {
  name: string;
  code: string;
  description?: string;
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string | null;
}

export interface RoleListItem {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  scope: 'ORG' | 'TEAM' | string;
  isSystem: boolean;
  createdAt: string;
  memberCount: number;
  permissionCount: number;
}

export interface RoleDetail {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  scope: 'ORG' | 'TEAM' | string;
  isSystem: boolean;
  createdAt: string;
  memberCount: number;
  members: MemberSummary[];
  permissions: PermissionSummary[];
}

/** @deprecated Prefer RoleListItem / RoleDetail */
export type Role = RoleListItem;

/** @deprecated Prefer PermissionListItem / PermissionDetail */
export type Permission = PermissionListItem;

export interface CreateRoleRequest {
  name: string;
  description?: string;
  scope: 'ORG' | 'TEAM';
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
}

export interface AssignRolePermissionsRequest {
  permissionIds: string[];
}

export interface AssignRoleMemberRequest {
  userId: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string | null;
}

export interface TeamMember {
  userId: string;
  roleId: string;
  roleName: string;
  jobTitle: string | null;
  joinedAt: string;
}

export interface AddTeamMemberRequest {
  userId: string;
  roleId: string;
  jobTitle?: string;
}

export interface UpdateTeamMemberRequest {
  roleId?: string;
  jobTitle?: string | null;
}

export interface Invitation {
  id: string;
  organizationId: string;
  teamId: string | null;
  email: string;
  invitedByUserId: string;
  orgRoleIds: string[];
  teamRoleId: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  token?: string | null;
}

export interface CreateInvitationRequest {
  email: string;
  orgRoleIds: string[];
  teamId?: string;
  teamRoleId?: string;
}

export interface MeMembership {
  userId: string;
  roles: RoleSummary[];
  joinedAt: string;
  permissions: string[];
  teams: TeamMembership[];
}

export type InvitationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired';
