import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  username: string;
  name: string;
  surname: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly _currentUser = signal<UserResponse | null>(null);
  private readonly _sessionReady = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly sessionReady = this._sessionReady.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  initialize(): Observable<void> {
    return this.refresh().pipe(
      tap((response) => this._currentUser.set(response.user)),
      catchError(() => {
        this._currentUser.set(null);
        return of(void 0);
      }),
      map(() => void 0),
      finalize(() => this._sessionReady.set(true)),
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, { username, password }, { withCredentials: true })
      .pipe(tap((response) => this._currentUser.set(response.user)));
  }

  register(data: { username: string; name: string; surname: string; password: string }): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/register`, data);
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, null, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, null, { withCredentials: true })
      .pipe(tap(() => this._currentUser.set(null)));
  }
}
