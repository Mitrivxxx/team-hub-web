import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  organizationId: string | null;
  createdAt: string;
  isRead: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.notificationsApiUrl;

  private orgBase(organizationId: string): string {
    return `${this.baseUrl}/organizations/${organizationId}`;
  }

  listForOrganization(organizationId: string): Observable<NotificationDto[]> {
    return this.http.get<NotificationDto[]>(this.orgBase(organizationId));
  }

  markAsRead(organizationId: string, id: string): Observable<void> {
    return this.http.post<void>(`${this.orgBase(organizationId)}/${id}/read`, {});
  }

  markAllAsRead(organizationId: string): Observable<void> {
    return this.http.post<void>(`${this.orgBase(organizationId)}/read-all`, {});
  }
}
