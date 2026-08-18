import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthService, UserResponse } from './auth.service';

const user: UserResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  email: 'alice@example.com',
  name: 'Alice',
  surname: 'Smith',
  avatarUrl: null,
};

describe('AuthService profile', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});
