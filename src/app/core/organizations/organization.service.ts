import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, switchMap, catchError, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateOrganizationInput, CreateOrganizationRequest, CreateOrganizationResult, Organization } from './organization.model';

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

  uploadAvatar(organizationId: string, file: File): Observable<Organization> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<Organization>(`${this.baseUrl}/${organizationId}/avatar`, formData);
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
}
