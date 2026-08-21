import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

const authRetried = new HttpContextToken(() => false);

const cookieAuthPathPattern = /\/api\/auth\/v\d+\/(login|refresh|logout|register|change-password)(\?|$)/;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const outgoing = withAccessToken(req, auth.accessToken());

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (!shouldRefresh(outgoing, error)) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        catchError(() => throwError(() => error)),
        switchMap(() => {
          const retry = withAccessToken(
            req.clone({ context: req.context.set(authRetried, true) }),
            auth.accessToken(),
          );
          return next(retry);
        }),
      );
    }),
  );
};

function shouldRefresh(req: HttpRequest<unknown>, error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
    return false;
  }

  if (req.context.get(authRetried) || isCookieAuthRequest(req)) {
    return false;
  }

  return true;
}

function isCookieAuthRequest(req: HttpRequest<unknown>): boolean {
  return cookieAuthPathPattern.test(req.url);
}

function withAccessToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token || isCookieAuthRequest(req) || req.headers.has('Authorization')) {
    return req;
  }

  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
