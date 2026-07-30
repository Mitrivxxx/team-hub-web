import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CorrelationContextService } from '../http/correlation-context.service';
import { AuthValidationError, FieldValidationErrors, parseApiFieldErrors } from './auth.errors';

export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  name: string;
  surname: string;
}

export type { FieldValidationErrors };
export { AuthValidationError };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly humanNameRegex = /^\p{L}+(?:[ '-]\p{L}+)*$/u;
  private static readonly usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

  private readonly http = inject(HttpClient);
  private readonly correlationContext = inject(CorrelationContextService);
  private readonly baseUrl = environment.apiUrl;
  private readonly _currentUser = signal<UserResponse | null>(null);
  private readonly _sessionReady = signal(false);
  private readonly _accessToken = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly sessionReady = this._sessionReady.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly accessToken = this._accessToken.asReadonly();

  initialize(): Observable<void> {
    return this.refresh().pipe(
      tap((response) => {
        this._currentUser.set(response.user);
        this._accessToken.set(response.accessToken);
      }),
      catchError(() => {
        this._currentUser.set(null);
        this._accessToken.set(null);
        return of(void 0);
      }),
      map(() => void 0),
      finalize(() => this._sessionReady.set(true)),
    );
  }

  login(username: string, password: string, rememberMe: boolean): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, { username, password, rememberMe }, { withCredentials: true })
      .pipe(
        tap((response) => {
          this._currentUser.set(response.user);
          this._accessToken.set(response.accessToken);
        }),
      );
  }

  register(data: {
    username: string;
    email: string;
    name: string;
    surname: string;
    password: string;
  }): Observable<AuthResponse> {
    const payload = {
      username: data.username.trim(),
      email: data.email.trim(),
      name: data.name.trim(),
      surname: data.surname.trim(),
      password: data.password,
    };

    const fieldErrors = this.validateRegisterPayload(payload);
    if (fieldErrors) {
      return throwError(() => new AuthValidationError('Registration validation failed.', fieldErrors, 400));
    }

    this.correlationContext.beginFlow();

    return this.http.post<UserResponse>(`${this.baseUrl}/register`, payload).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const apiFieldErrors = parseApiFieldErrors(error);
          if (apiFieldErrors) {
            return throwError(
              () => new AuthValidationError('Registration validation failed.', apiFieldErrors, error.status),
            );
          }
        }

        return throwError(() => error);
      }),
      switchMap(() => this.login(payload.username, payload.password, false)),
      finalize(() => this.correlationContext.endFlow()),
    );
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, null, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, null, { withCredentials: true })
      .pipe(
        tap(() => {
          this._currentUser.set(null);
          this._accessToken.set(null);
        }),
      );
  }

  searchUsers(q: string, pageSize = 20): Observable<UserResponse[]> {
    const params: Record<string, string> = {
      page: '1',
      pageSize: String(pageSize),
    };
    const term = q.trim();
    if (term) {
      params['q'] = term;
    }
    return this.http.get<UserResponse[]>(`${this.baseUrl}/users`, { params });
  }

  changePassword(data: {
    username: string;
    name: string;
    surname: string;
    password: string;
  }): Observable<void> {
    const payload = {
      username: data.username.trim(),
      name: data.name.trim(),
      surname: data.surname.trim(),
      password: data.password,
    };

    const fieldErrors = this.validateChangePasswordPayload(payload);
    if (fieldErrors) {
      return throwError(() => new AuthValidationError('Password change validation failed.', fieldErrors, 400));
    }

    return this.http.post<void>(`${this.baseUrl}/change-password`, payload).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const apiFieldErrors = parseApiFieldErrors(error);
          if (apiFieldErrors) {
            return throwError(
              () => new AuthValidationError('Password change validation failed.', apiFieldErrors, error.status),
            );
          }
        }

        return throwError(() => error);
      }),
    );
  }

  private validateRegisterPayload(
    data: { username: string; email: string; name: string; surname: string; password: string },
  ): FieldValidationErrors | null {
    const fieldErrors: FieldValidationErrors = {};

    if (data.name.length < 2 || data.name.length > 50 || !AuthService.humanNameRegex.test(data.name)) {
      fieldErrors['name'] = ['First name is invalid.'];
    }

    if (data.surname.length < 2 || data.surname.length > 80 || !AuthService.humanNameRegex.test(data.surname)) {
      fieldErrors['surname'] = ['Last name is invalid.'];
    }

    if (!AuthService.usernameRegex.test(data.username)) {
      fieldErrors['username'] = ['Username is invalid.'];
    }

    const email = data.email.trim();
    if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors['email'] = ['Email is invalid.'];
    }

    if (data.password.length < 8 || data.password.length > 128) {
      fieldErrors['password'] = ['Password must be 8-128 characters long.'];
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
  }

  private validateChangePasswordPayload(
    data: { username: string; name: string; surname: string; password: string },
  ): FieldValidationErrors | null {
    const fieldErrors: FieldValidationErrors = {};

    if (data.name.length < 2 || data.name.length > 50 || !AuthService.humanNameRegex.test(data.name)) {
      fieldErrors['name'] = ['First name is invalid.'];
    }

    if (data.surname.length < 2 || data.surname.length > 80 || !AuthService.humanNameRegex.test(data.surname)) {
      fieldErrors['surname'] = ['Last name is invalid.'];
    }

    if (!AuthService.usernameRegex.test(data.username)) {
      fieldErrors['username'] = ['Username is invalid.'];
    }

    if (data.password.length < 8 || data.password.length > 128) {
      fieldErrors['password'] = ['Password must be 8-128 characters long.'];
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
  }
}
