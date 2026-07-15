import { HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { SessionContextService } from './session-context.service';

const SESSION_ID_HEADER = 'X-Session-ID';

export const sessionIdInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionContext = inject(SessionContextService);
  const sessionId = sessionContext.getOrCreate();

  return next(
    req.clone({
      setHeaders: {
        [SESSION_ID_HEADER]: sessionId,
      },
    }),
  ).pipe(
    tap((event) => {
      if (event.type !== HttpEventType.Response) {
        return;
      }

      sessionContext.syncFromResponse(event.headers.get(SESSION_ID_HEADER));
    }),
  );
};
