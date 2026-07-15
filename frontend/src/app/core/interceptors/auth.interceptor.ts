import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs';

const AUTH_TOKEN_KEY = 'vinyl_auth_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const startTime = Date.now();

  let authReq = req;
  if (token && !req.headers.has('Authorization')) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  return next(authReq).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const duration = Date.now() - startTime;
          console.info(
            `[API Info] ${req.method} ${req.url} - Status: ${event.status} - Time: ${duration}ms`
          );
        }
      },
      error: (error) => {
        const duration = Date.now() - startTime;
        if (error instanceof HttpErrorResponse) {
          console.error(
            `[API Error] ${req.method} ${req.url} - Status: ${error.status} - Time: ${duration}ms - Error: ${error.message}`
          );
        }
      },
    })
  );
};
