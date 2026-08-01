import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ActivityUser,
  Member,
  MemberUser,
  OrganizationActivityPage,
  RoleSummary,
} from './organization.model';

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

interface OrganizationActivityData {
  organizationActivity: {
    page: number;
    pageSize: number;
    totalCount: number;
    items: Array<{
      id: string;
      type: string;
      actorUserId: string | null;
      targetUserId: string | null;
      entityType: string | null;
      entityId: string | null;
      details: string | null;
      occurredAt: string;
      actor: ActivityUser | null;
      target: ActivityUser | null;
    }>;
  };
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

const ORGANIZATION_ACTIVITY_QUERY = `
  query OrganizationActivity(
    $organizationId: String!
    $type: String
    $q: String
    $from: String
    $to: String
    $page: Int
    $pageSize: Int
  ) {
    organizationActivity(
      organizationId: $organizationId
      type: $type
      q: $q
      from: $from
      to: $to
      page: $page
      pageSize: $pageSize
    ) {
      page
      pageSize
      totalCount
      items {
        id
        type
        actorUserId
        targetUserId
        entityType
        entityId
        details
        occurredAt
        actor {
          username
          name
          surname
        }
        target {
          username
          name
          surname
        }
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

  listActivity(
    organizationId: string,
    filters?: {
      type?: string;
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ): Observable<OrganizationActivityPage> {
    return this.http
      .post<GraphQlResponse<OrganizationActivityData>>(this.graphqlUrl, {
        query: ORGANIZATION_ACTIVITY_QUERY,
        variables: {
          organizationId,
          type: filters?.type || null,
          q: filters?.q || null,
          from: filters?.from || null,
          to: filters?.to || null,
          page: filters?.page ?? 1,
          pageSize: filters?.pageSize ?? 20,
        },
      })
      .pipe(
        map((response) => {
          if (response.errors?.length) {
            throw new Error(response.errors.map((e) => e.message).join('; '));
          }

          const page = response.data?.organizationActivity;
          return {
            page: page?.page ?? 1,
            pageSize: page?.pageSize ?? 20,
            totalCount: page?.totalCount ?? 0,
            items: (page?.items ?? []).map((item) => ({
              id: item.id,
              type: item.type,
              actorUserId: item.actorUserId,
              targetUserId: item.targetUserId,
              entityType: item.entityType,
              entityId: item.entityId,
              details: item.details,
              occurredAt: item.occurredAt,
              actor: item.actor,
              target: item.target,
            })),
          };
        }),
      );
  }
}
