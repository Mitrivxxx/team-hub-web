import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, UserResponse } from '../../../core/auth/auth.service';
import { Header } from './header';

describe('Header', () => {
  it('shows initials when the user has no avatar', async () => {
    const currentUser = signal<UserResponse | null>({
      id: '1',
      username: 'alice',
      email: 'alice@example.com',
      name: 'Alice',
      surname: 'Smith',
      avatarUrl: null,
    });

    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUser.asReadonly(),
            isAuthenticated: () => true,
            sessionReady: () => true,
            logout: () => ({ subscribe: () => undefined }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.site-header__avatar')?.textContent?.trim()).toBe('AS');
  });
});
