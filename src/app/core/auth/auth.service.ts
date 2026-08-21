import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

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
  avatarUrl?: string | null;
}

export type { FieldValidationErrors };
export { AuthValidationError };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly humanNameRegex = /^\p{L}+(?:[ '-]\p{L}+)*$/u;
  private static readonly usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly correlationContext = inject(CorrelationContextService);
  private readonly baseUrl = environment.apiUrl;
  private readonly _currentUser = signal<UserResponse | null>(null);
  private readonly _sessionReady = signal(false);
  private readonly _accessToken = signal<string | null>(null);
  private initInFlight$: Observable<void> | null = null;
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  readonly currentUser = this._currentUser.asReadonly();
  readonly sessionReady = this._sessionReady.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly accessToken = this._accessToken.asReadonly();

  initialize(): Observable<void> {
    if (this._sessionReady()) {
      return of(void 0);
    }

    if (!this.initInFlight$) {
      this.initInFlight$ = this.refresh().pipe(
        catchError(() => of(void 0)),
        map(() => void 0),
        finalize(() => {
          this._sessionReady.set(true);
          this.initInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.initInFlight$;
  }

  login(username: string, password: string, rememberMe: boolean): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, { username, password, rememberMe }, { withCredentials: true })
      .pipe(tap((response) => this.applyAuth(response)));
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
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<AuthResponse>(`${this.baseUrl}/refresh`, null, { withCredentials: true })
        .pipe(
          tap((response) => this.applyAuth(response)),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.handleLostSession();
            }
            return throwError(() => error);
          }),
          finalize(() => {
            this.refreshInFlight$ = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.refreshInFlight$;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, null, { withCredentials: true }).pipe(
      tap(() => this.clearLocalSession()),
      catchError(() => {
        this.clearLocalSession();
        return of(void 0);
      }),
    );
  }

  /** Clears in-memory auth state after server-side session revoke (password/email change). */
  clearLocalSession(): void {
    this._currentUser.set(null);
    this._accessToken.set(null);
  }

  searchUsers(q: string, pageSize = 20): Observable<UserResponse[]> {
    const term = q.trim();
    if (term.length < 2) {
      return of([]);
    }
    const params: Record<string, string> = {
      page: '1',
      pageSize: String(pageSize),
      q: term,
    };
    return this.http.get<UserResponse[]>(`${this.baseUrl}/users`, { params });
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/me`).pipe(tap((user) => this._currentUser.set(user)));
  }

  updateMe(data: { name?: string; surname?: string; email?: string }): Observable<UserResponse> {
    const payload: { name?: string; surname?: string; email?: string } = {};
    if (data.name !== undefined) {
      payload.name = data.name.trim();
    }
    if (data.surname !== undefined) {
      payload.surname = data.surname.trim();
    }
    if (data.email !== undefined) {
      payload.email = data.email.trim();
    }

    const fieldErrors = this.validateUpdateMePayload(payload);
    if (fieldErrors) {
      return throwError(() => new AuthValidationError('Profile update validation failed.', fieldErrors, 400));
    }

    return this.http.patch<UserResponse>(`${this.baseUrl}/me`, payload).pipe(
      tap((user) => this._currentUser.set(user)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          const apiFieldErrors = parseApiFieldErrors(error);
          if (apiFieldErrors) {
            return throwError(
              () => new AuthValidationError('Profile update validation failed.', apiFieldErrors, error.status),
            );
          }
        }

        return throwError(() => error);
      }),
    );
  }

  changeMyPassword(currentPassword: string, newPassword: string): Observable<void> {
    if (newPassword.length < 8 || newPassword.length > 128) {
      return throwError(
        () =>
          new AuthValidationError(
            'Password change validation failed.',
            { newPassword: ['Password must be 8-128 characters long.'] },
            400,
          ),
      );
    }

    return this.http.post<void>(`${this.baseUrl}/me/change-password`, { currentPassword, newPassword }).pipe(
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

  uploadAvatar(file: File): Observable<UserResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<UserResponse>(`${this.baseUrl}/me/avatar`, formData).pipe(tap((user) => this._currentUser.set(user)));
  }

  deleteAvatar(): Observable<UserResponse> {
    return this.http
      .delete<UserResponse>(`${this.baseUrl}/me/avatar`)
      .pipe(tap((user) => this._currentUser.set(user)));
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

  private validateUpdateMePayload(data: {
    name?: string;
    surname?: string;
    email?: string;
  }): FieldValidationErrors | null {
    const fieldErrors: FieldValidationErrors = {};

    if (data.name !== undefined && (data.name.length < 2 || data.name.length > 50 || !AuthService.humanNameRegex.test(data.name))) {
      fieldErrors['name'] = ['First name is invalid.'];
    }

    if (
      data.surname !== undefined &&
      (data.surname.length < 2 || data.surname.length > 80 || !AuthService.humanNameRegex.test(data.surname))
    ) {
      fieldErrors['surname'] = ['Last name is invalid.'];
    }

    if (data.email !== undefined) {
      const email = data.email.trim();
      if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fieldErrors['email'] = ['Email is invalid.'];
      }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
  }

  private applyAuth(response: AuthResponse): void {
    this._currentUser.set(response.user);
    this._accessToken.set(response.accessToken);
    this._sessionReady.set(true);
  }

  private handleLostSession(): void {
    const wasAuthenticated = this._currentUser() !== null || this._accessToken() !== null;
    this.clearLocalSession();
    if (!wasAuthenticated) {
      return;
    }

    const url = this.router.url;
    if (!url.startsWith('/app')) {
      return;
    }

    void this.router.navigate(['/login'], { queryParams: { returnUrl: url } });
  }
}
