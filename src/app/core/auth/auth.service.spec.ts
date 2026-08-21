import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AuthService, AuthResponse, UserResponse } from './auth.service';

const user: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  surname: 'Smith',
  avatarUrl: null,
};

const authResponse: AuthResponse = {
  accessToken: 'access-token',
  expiresInSeconds: 900,
  user,
};

describe('AuthService profile', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getMe stores the current user', () => {
    let result: UserResponse | undefined;
    service.getMe().subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/me`);
    expect(req.request.method).toBe('GET');
    req.flush(user);

    expect(result).toEqual(user);
    expect(service.currentUser()).toEqual(user);
  });

  it('updateMe patches profile and updates current user', () => {
    const updated = { ...user, name: 'Alicja' };
    let result: UserResponse | undefined;
    service.updateMe({ name: 'Alicja' }).subscribe((response) => {
      result = response;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/me`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Alicja' });
    req.flush(updated);

    expect(result?.name).toBe('Alicja');
    expect(service.currentUser()?.name).toBe('Alicja');
  });

  it('initialize restores the session from refresh once', () => {
    let firstReady = false;
    let secondReady = false;
    service.initialize().subscribe(() => {
      firstReady = true;
    });
    service.initialize().subscribe(() => {
      secondReady = true;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/refresh`);
    expect(req.request.withCredentials).toBe(true);
    req.flush(authResponse);

    expect(firstReady).toBe(true);
    expect(secondReady).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('access-token');
    expect(service.sessionReady()).toBe(true);
  });

  it('refresh shares one in-flight request', () => {
    let first: AuthResponse | undefined;
    let second: AuthResponse | undefined;
    service.refresh().subscribe((response) => {
      first = response;
    });
    service.refresh().subscribe((response) => {
      second = response;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/refresh`);
    req.flush(authResponse);

    expect(first).toEqual(authResponse);
    expect(second).toEqual(authResponse);
    expect(service.accessToken()).toBe('access-token');
  });

  it('initialize stays ready after a failed refresh', () => {
    let completed = false;
    service.initialize().subscribe(() => {
      completed = true;
    });

    httpMock.expectOne(`${environment.apiUrl}/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(completed).toBe(true);
    expect(service.sessionReady()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });
});
