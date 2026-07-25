import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, switchMap, catchError, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AddMemberRequest,
  AddTeamMemberRequest,
  CreateInvitationRequest,
  CreateOrganizationInput,
  CreateOrganizationRequest,
  CreateOrganizationResult,
  CreateRoleRequest,
  CreateTeamRequest,
  Invitation,
  InvitationStatus,
  Member,
  MeMembership,
  Organization,
  Permission,
  Role,
  RolePermissionsRequest,
  Team,
  TeamMember,
  TeamMembership,
  TransferOwnershipRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UpdateRoleRequest,
  UpdateTeamMemberRequest,
  UpdateTeamRequest,
} from './organization.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.organizationsApiUrl;

  list(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.baseUrl);
  }

  getBySlug(slug: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/by-slug/${encodeURIComponent(slug)}`);
  }

  create(request: CreateOrganizationRequest): Observable<Organization> {
    return this.http.post<Organization>(this.baseUrl, request);
  }

  update(organizationId: string, request: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.patch<Organization>(`${this.baseUrl}/${organizationId}`, request);
  }

  delete(organizationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}`);
  }

  transferOwnership(organizationId: string, request: TransferOwnershipRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${organizationId}/transfer-ownership`, request);
  }

  leave(organizationId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${organizationId}/leave`, {});
  }

  uploadAvatar(organizationId: string, file: File): Observable<Organization> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<Organization>(`${this.baseUrl}/${organizationId}/avatar`, formData);
  }

  deleteAvatar(organizationId: string): Observable<Organization> {
    return this.http.delete<Organization>(`${this.baseUrl}/${organizationId}/avatar`);
  }

  createWithDetails(input: CreateOrganizationInput): Observable<CreateOrganizationResult> {
    const body: CreateOrganizationRequest = {
      name: input.name,
      description: input.description,
    };

    return this.create(body).pipe(
      switchMap((organization) => {
        if (!input.avatar) {
          return of({ organization, avatarUploadFailed: false });
        }

        return this.uploadAvatar(organization.id, input.avatar).pipe(
          map((updated) => ({ organization: updated, avatarUploadFailed: false })),
          catchError(() => of({ organization, avatarUploadFailed: true })),
        );
      }),
    );
  }

  getMe(organizationId: string): Observable<MeMembership> {
    return this.http.get<MeMembership>(`${this.baseUrl}/${organizationId}/me`);
  }

  listMyInvitations(): Observable<Invitation[]> {
    return this.http.get<Invitation[]>(`${this.baseUrl}/me/invitations`);
  }

  listMembers(
    organizationId: string,
    filters?: { roleId?: string; teamId?: string },
  ): Observable<Member[]> {
    let params = new HttpParams();
    if (filters?.roleId) {
      params = params.set('roleId', filters.roleId);
    }
    if (filters?.teamId) {
      params = params.set('teamId', filters.teamId);
    }
    return this.http.get<Member[]>(`${this.baseUrl}/${organizationId}/members`, { params });
  }

  getMember(organizationId: string, userId: string): Observable<Member> {
    return this.http.get<Member>(`${this.baseUrl}/${organizationId}/members/${userId}`);
  }

  addMember(organizationId: string, request: AddMemberRequest): Observable<Member> {
    return this.http.post<Member>(`${this.baseUrl}/${organizationId}/members`, request);
  }

  updateMember(organizationId: string, userId: string, request: UpdateMemberRequest): Observable<Member> {
    return this.http.patch<Member>(`${this.baseUrl}/${organizationId}/members/${userId}`, request);
  }

  removeMember(organizationId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/members/${userId}`);
  }

  listMemberTeams(organizationId: string, userId: string): Observable<TeamMembership[]> {
    return this.http.get<TeamMembership[]>(`${this.baseUrl}/${organizationId}/members/${userId}/teams`);
  }

  listTeams(organizationId: string): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.baseUrl}/${organizationId}/teams`);
  }

  getTeam(organizationId: string, teamId: string): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/${organizationId}/teams/${teamId}`);
  }

  createTeam(organizationId: string, request: CreateTeamRequest): Observable<Team> {
    return this.http.post<Team>(`${this.baseUrl}/${organizationId}/teams`, request);
  }

  updateTeam(organizationId: string, teamId: string, request: UpdateTeamRequest): Observable<Team> {
    return this.http.patch<Team>(`${this.baseUrl}/${organizationId}/teams/${teamId}`, request);
  }

  deleteTeam(organizationId: string, teamId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/teams/${teamId}`);
  }

  uploadTeamAvatar(organizationId: string, teamId: string, file: File): Observable<Team> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<Team>(`${this.baseUrl}/${organizationId}/teams/${teamId}/avatar`, formData);
  }

  deleteTeamAvatar(organizationId: string, teamId: string): Observable<Team> {
    return this.http.delete<Team>(`${this.baseUrl}/${organizationId}/teams/${teamId}/avatar`);
  }

  listTeamMembers(organizationId: string, teamId: string): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.baseUrl}/${organizationId}/teams/${teamId}/members`);
  }

  addTeamMember(organizationId: string, teamId: string, request: AddTeamMemberRequest): Observable<TeamMember> {
    return this.http.post<TeamMember>(`${this.baseUrl}/${organizationId}/teams/${teamId}/members`, request);
  }

  updateTeamMember(
    organizationId: string,
    teamId: string,
    userId: string,
    request: UpdateTeamMemberRequest,
  ): Observable<TeamMember> {
    return this.http.patch<TeamMember>(
      `${this.baseUrl}/${organizationId}/teams/${teamId}/members/${userId}`,
      request,
    );
  }

  removeTeamMember(organizationId: string, teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/teams/${teamId}/members/${userId}`);
  }

  listPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.baseUrl}/permissions`);
  }

  listRoles(organizationId: string, scope?: 'ORG' | 'TEAM'): Observable<Role[]> {
    let params = new HttpParams();
    if (scope) {
      params = params.set('scope', scope);
    }
    return this.http.get<Role[]>(`${this.baseUrl}/${organizationId}/roles`, { params });
  }

  getRole(organizationId: string, roleId: string): Observable<Role> {
    return this.http.get<Role>(`${this.baseUrl}/${organizationId}/roles/${roleId}`);
  }

  createRole(organizationId: string, request: CreateRoleRequest): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/${organizationId}/roles`, request);
  }

  updateRole(organizationId: string, roleId: string, request: UpdateRoleRequest): Observable<Role> {
    return this.http.patch<Role>(`${this.baseUrl}/${organizationId}/roles/${roleId}`, request);
  }

  deleteRole(organizationId: string, roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/roles/${roleId}`);
  }

  replaceRolePermissions(organizationId: string, roleId: string, request: RolePermissionsRequest): Observable<Role> {
    return this.http.put<Role>(`${this.baseUrl}/${organizationId}/roles/${roleId}/permissions`, request);
  }

  addRolePermissions(organizationId: string, roleId: string, request: RolePermissionsRequest): Observable<Role> {
    return this.http.post<Role>(`${this.baseUrl}/${organizationId}/roles/${roleId}/permissions`, request);
  }

  removeRolePermission(organizationId: string, roleId: string, permissionCode: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${organizationId}/roles/${roleId}/permissions/${encodeURIComponent(permissionCode)}`,
    );
  }

  listInvitations(organizationId: string, status?: InvitationStatus): Observable<Invitation[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Invitation[]>(`${this.baseUrl}/${organizationId}/invitations`, { params });
  }

  getInvitation(organizationId: string, invitationId: string): Observable<Invitation> {
    return this.http.get<Invitation>(`${this.baseUrl}/${organizationId}/invitations/${invitationId}`);
  }

  createInvitation(organizationId: string, request: CreateInvitationRequest): Observable<Invitation> {
    return this.http.post<Invitation>(`${this.baseUrl}/${organizationId}/invitations`, request);
  }

  cancelInvitation(organizationId: string, invitationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/invitations/${invitationId}`);
  }

  resendInvitation(organizationId: string, invitationId: string): Observable<Invitation> {
    return this.http.post<Invitation>(`${this.baseUrl}/${organizationId}/invitations/${invitationId}/resend`, {});
  }

  getInvitationByToken(token: string): Observable<Invitation> {
    return this.http.get<Invitation>(`${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}`);
  }

  acceptInvitation(token: string): Observable<Member> {
    return this.http.post<Member>(`${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}/accept`, {});
  }

  rejectInvitation(token: string): Observable<Invitation> {
    return this.http.post<Invitation>(`${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}/reject`, {});
  }
}
