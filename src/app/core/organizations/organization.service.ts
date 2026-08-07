import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AddMemberRequest,
  AddTeamMemberRequest,
  AssignRolePermissionsRequest,
  CreateExportRequest,
  CreateInvitationRequest,
  CreateOrganizationInput,
  CreateOrganizationResult,
  CreatePermissionRequest,
  CreateRoleRequest,
  CreateTeamRequest,
  ImportExportDownload,
  ImportExportJob,
  ImportExportJobAccepted,
  ImportPreviewResponse,
  Invitation,
  Member,
  MeMembership,
  Organization,
  OrganizationStats,
  PermissionDetail,
  PermissionListItem,
  PermissionSummary,
  RoleDetail,
  RoleListItem,
  Team,
  TeamMember,
  TeamMembership,
  TransferOwnershipRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UpdateOrganizationStatusRequest,
  UpdatePermissionRequest,
  UpdateRoleRequest,
  UpdateTeamMemberRequest,
  UpdateTeamRequest,
} from './organization.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.organizationsApiUrl;

  list(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.baseUrl}`);
  }

  getById(organizationId: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/${organizationId}`);
  }

  getBySlug(slug: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/by-slug/${slug}`);
  }

  getStats(organizationId: string): Observable<OrganizationStats> {
    return this.http.get<OrganizationStats>(`${this.baseUrl}/${organizationId}/stats`);
  }

  getMe(organizationId: string): Observable<MeMembership> {
    return this.http.get<MeMembership>(`${this.baseUrl}/${organizationId}/me`);
  }

  listMyInvitations(): Observable<Invitation[]> {
    return this.http.get<Invitation[]>(`${this.baseUrl}/me/invitations`);
  }

  createWithDetails(input: CreateOrganizationInput): Observable<CreateOrganizationResult> {
    return this.http
      .post<Organization>(`${this.baseUrl}`, {
        name: input.name,
        description: input.description,
        nip: input.nip,
        address: input.address,
      })
      .pipe(
        switchMap((organization) => {
          if (!input.avatar) {
            return of({ organization, avatarUploadFailed: false });
          }
          const formData = new FormData();
          formData.append('file', input.avatar);
          return this.http
            .put<Organization>(`${this.baseUrl}/${organization.id}/avatar`, formData)
            .pipe(
              map((updated) => ({ organization: updated, avatarUploadFailed: false })),
              catchError(() => of({ organization, avatarUploadFailed: true })),
            );
        }),
      );
  }

  update(organizationId: string, request: UpdateOrganizationRequest): Observable<Organization> {
    return this.http.patch<Organization>(`${this.baseUrl}/${organizationId}`, request);
  }

  updateStatus(
    organizationId: string,
    request: UpdateOrganizationStatusRequest,
  ): Observable<Organization> {
    return this.http.patch<Organization>(`${this.baseUrl}/${organizationId}/status`, request);
  }

  delete(organizationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}`);
  }

  restore(organizationId: string): Observable<Organization> {
    return this.http.post<Organization>(`${this.baseUrl}/${organizationId}/restore`, {});
  }

  transferOwnership(
    organizationId: string,
    request: TransferOwnershipRequest,
  ): Observable<void> {
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

  listRoles(organizationId: string, scope?: string): Observable<RoleListItem[]> {
    let params = new HttpParams();
    if (scope) {
      params = params.set('scope', scope);
    }
    return this.http.get<RoleListItem[]>(`${this.baseUrl}/${organizationId}/roles`, { params });
  }

  createRole(organizationId: string, request: CreateRoleRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${organizationId}/roles`, request);
  }

  getRole(organizationId: string, roleId: string): Observable<RoleDetail> {
    return this.http.get<RoleDetail>(`${this.baseUrl}/${organizationId}/roles/${roleId}`);
  }

  updateRole(
    organizationId: string,
    roleId: string,
    request: UpdateRoleRequest,
  ): Observable<RoleDetail> {
    return this.http.patch<RoleDetail>(`${this.baseUrl}/${organizationId}/roles/${roleId}`, request);
  }

  replaceRolePermissions(
    organizationId: string,
    roleId: string,
    request: AssignRolePermissionsRequest,
  ): Observable<PermissionSummary[]> {
    return this.http.put<PermissionSummary[]>(
      `${this.baseUrl}/${organizationId}/roles/${roleId}/permissions`,
      request,
    );
  }

  deleteRole(organizationId: string, roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/roles/${roleId}`);
  }

  listPermissions(organizationId: string): Observable<PermissionListItem[]> {
    return this.http.get<PermissionListItem[]>(`${this.baseUrl}/${organizationId}/permissions`);
  }

  createPermission(organizationId: string, request: CreatePermissionRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${organizationId}/permissions`, request);
  }

  getPermission(organizationId: string, permissionId: string): Observable<PermissionDetail> {
    return this.http.get<PermissionDetail>(
      `${this.baseUrl}/${organizationId}/permissions/${permissionId}`,
    );
  }

  updatePermission(
    organizationId: string,
    permissionId: string,
    request: UpdatePermissionRequest,
  ): Observable<PermissionDetail> {
    return this.http.patch<PermissionDetail>(
      `${this.baseUrl}/${organizationId}/permissions/${permissionId}`,
      request,
    );
  }

  deletePermission(organizationId: string, permissionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${organizationId}/permissions/${permissionId}`,
    );
  }

  getMember(organizationId: string, userId: string): Observable<Member> {
    return this.http.get<Member>(`${this.baseUrl}/${organizationId}/members/${userId}`);
  }

  listMemberTeams(organizationId: string, userId: string): Observable<TeamMembership[]> {
    return this.http.get<TeamMembership[]>(
      `${this.baseUrl}/${organizationId}/members/${userId}/teams`,
    );
  }

  addMember(organizationId: string, request: AddMemberRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${organizationId}/members`, request);
  }

  updateMember(organizationId: string, userId: string, request: UpdateMemberRequest): Observable<Member> {
    return this.http.patch<Member>(`${this.baseUrl}/${organizationId}/members/${userId}`, request);
  }

  removeMember(organizationId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${organizationId}/members/${userId}`);
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

  updateTeam(
    organizationId: string,
    teamId: string,
    request: UpdateTeamRequest,
  ): Observable<Team> {
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
    return this.http.post<TeamMember>(
      `${this.baseUrl}/${organizationId}/teams/${teamId}/members`,
      request,
    );
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
    return this.http.delete<void>(
      `${this.baseUrl}/${organizationId}/teams/${teamId}/members/${userId}`,
    );
  }

  listInvitations(organizationId: string, status?: string): Observable<Invitation[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Invitation[]>(`${this.baseUrl}/${organizationId}/invitations`, { params });
  }

  getInvitation(organizationId: string, invitationId: string): Observable<Invitation> {
    return this.http.get<Invitation>(
      `${this.baseUrl}/${organizationId}/invitations/${invitationId}`,
    );
  }

  createInvitation(organizationId: string, request: CreateInvitationRequest): Observable<Invitation> {
    return this.http.post<Invitation>(`${this.baseUrl}/${organizationId}/invitations`, request);
  }

  resendInvitation(organizationId: string, invitationId: string): Observable<Invitation> {
    return this.http.post<Invitation>(
      `${this.baseUrl}/${organizationId}/invitations/${invitationId}/resend`,
      {},
    );
  }

  getInvitationByToken(token: string): Observable<Invitation> {
    return this.http.get<Invitation>(`${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}`);
  }

  acceptInvitationByToken(token: string): Observable<Member> {
    return this.http.post<Member>(
      `${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}/accept`,
      {},
    );
  }

  rejectInvitationByToken(token: string): Observable<Invitation> {
    return this.http.post<Invitation>(
      `${this.baseUrl}/invitations/by-token/${encodeURIComponent(token)}/reject`,
      {},
    );
  }

  cancelInvitation(organizationId: string, invitationId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${organizationId}/invitations/${invitationId}`,
    );
  }

  previewImport(organizationId: string, file: File): Observable<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportPreviewResponse>(
      `${this.baseUrl}/${organizationId}/imports/preview`,
      formData,
    );
  }

  startImport(organizationId: string, file: File): Observable<ImportExportJobAccepted> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportExportJobAccepted>(
      `${this.baseUrl}/${organizationId}/imports`,
      formData,
    );
  }

  startExport(organizationId: string, request: CreateExportRequest): Observable<ImportExportJobAccepted> {
    return this.http.post<ImportExportJobAccepted>(
      `${this.baseUrl}/${organizationId}/exports`,
      request,
    );
  }

  listImportExportJobs(
    organizationId: string,
    page = 1,
    pageSize = 20,
  ): Observable<ImportExportJob[]> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<ImportExportJob[]>(
      `${this.baseUrl}/${organizationId}/import-export/jobs`,
      { params },
    );
  }

  getImportExportJob(organizationId: string, jobId: string): Observable<ImportExportJob> {
    return this.http.get<ImportExportJob>(
      `${this.baseUrl}/${organizationId}/import-export/jobs/${jobId}`,
    );
  }

  getImportExportDownload(
    organizationId: string,
    jobId: string,
    artifact: 'result' | 'errors' | 'source',
  ): Observable<ImportExportDownload> {
    const params = new HttpParams().set('artifact', artifact);
    return this.http.get<ImportExportDownload>(
      `${this.baseUrl}/${organizationId}/import-export/jobs/${jobId}/download`,
      { params },
    );
  }
}
