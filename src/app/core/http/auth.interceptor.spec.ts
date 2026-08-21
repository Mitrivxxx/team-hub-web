import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService, AuthResponse, UserResponse } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

const user: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  surname: 'Smith',
  avatarUrl: null,
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('retries an API call after refreshing an expired access token', () => {
    login('token-1');

    let body: unknown;
    http.get('/api/organizations/v1/by-slug/acme').subscribe((response) => {
      body = response;
    });

    const first = httpMock.expectOne('/api/organizations/v1/by-slug/acme');
    expect(first.request.headers.get('Authorization')).toBe('Bearer token-1');
    first.flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne(`${environment.apiUrl}/refresh`).flush(authPayload('token-2'));

    const retry = httpMock.expectOne('/api/organizations/v1/by-slug/acme');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-2');
    retry.flush({ slug: 'acme' });

    expect(body).toEqual({ slug: 'acme' });
    expect(auth.accessToken()).toBe('token-2');
  });

  it('does not refresh on login 401', () => {
    let status = 0;
    http.post(`${environment.apiUrl}/login`, { username: 'alice', password: 'bad' }).subscribe({
      error: (error: { status?: number }) => {
        status = error.status ?? 0;
      },
    });

    httpMock.expectOne(`${environment.apiUrl}/login`).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectNone(`${environment.apiUrl}/refresh`);
    expect(status).toBe(401);
  });

  function login(accessToken: string): void {
    auth.login('alice', 'secret123', false).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/login`).flush(authPayload(accessToken));
  }

  function authPayload(accessToken: string): AuthResponse {
    return { accessToken, expiresInSeconds: 900, user };
  }
});
