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

export interface Member {
  userId: string;
  roleId: string;
  roleName: string;
  joinedAt: string;
  teamIds: string[];
}

export interface AddMemberRequest {
  userId: string;
  roleId: string;
}

export interface UpdateMemberRequest {
  roleId: string;
}

export interface TeamMembership {
  teamId: string;
  teamName: string;
  roleId: string;
  roleName: string;
  jobTitle: string | null;
  joinedAt: string;
}

export interface Permission {
  id: string;
  code: string;
  description: string | null;
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  scope: 'ORG' | 'TEAM';
  createdAt: string;
  permissionCodes: string[];
  isSystem: boolean;
}

export interface CreateRoleRequest {
  name: string;
  scope: 'ORG' | 'TEAM';
}

export interface UpdateRoleRequest {
  name?: string;
}

export interface RolePermissionsRequest {
  permissionCodes: string[];
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
  orgRoleId: string;
  teamRoleId: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  token?: string | null;
}

export interface CreateInvitationRequest {
  email: string;
  orgRoleId: string;
  teamId?: string;
  teamRoleId?: string;
}

export interface MeMembership {
  userId: string;
  roleId: string;
  roleName: string;
  joinedAt: string;
  permissions: string[];
  teams: TeamMembership[];
}

export type InvitationStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Expired';
