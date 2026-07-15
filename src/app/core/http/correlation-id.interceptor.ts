import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { CorrelationContextService } from './correlation-context.service';

const CORRELATION_ID_HEADER = 'X-Correlation-ID';

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationContext = inject(CorrelationContextService);
  const correlationId = correlationContext.getCurrent() ?? crypto.randomUUID();

  return next(
    req.clone({
      setHeaders: {
        [CORRELATION_ID_HEADER]: correlationId,
      },
    }),
  );
};
