import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Member, MemberUser, RoleSummary } from './organization.model';

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface OrganizationMembersData {
  organizationMembers: Array<{
    userId: string;
    joinedAt: string;
    teamIds: string[];
    roles: RoleSummary[];
    user: MemberUser | null;
  }>;
}

const ORGANIZATION_MEMBERS_QUERY = `
  query OrganizationMembers($organizationId: String!, $roleId: String, $teamId: String) {
    organizationMembers(organizationId: $organizationId, roleId: $roleId, teamId: $teamId) {
      userId
      joinedAt
      teamIds
      roles {
        id
        name
        scope
        isSystem
      }
      user {
        username
        name
        surname
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class OrganizationGraphqlService {
  private readonly http = inject(HttpClient);
  private readonly graphqlUrl = environment.graphqlUrl;

  listMembers(
    organizationId: string,
    filters?: { roleId?: string; teamId?: string },
  ): Observable<Member[]> {
    return this.http
      .post<GraphQlResponse<OrganizationMembersData>>(this.graphqlUrl, {
        query: ORGANIZATION_MEMBERS_QUERY,
        variables: {
          organizationId,
          roleId: filters?.roleId || null,
          teamId: filters?.teamId || null,
        },
      })
      .pipe(
        map((response) => {
          if (response.errors?.length) {
            throw new Error(response.errors.map((e) => e.message).join('; '));
          }

          return (response.data?.organizationMembers ?? []).map((member) => ({
            userId: member.userId,
            joinedAt: member.joinedAt,
            teamIds: member.teamIds ?? [],
            roles: member.roles ?? [],
            user: member.user,
          }));
        }),
      );
  }
}
