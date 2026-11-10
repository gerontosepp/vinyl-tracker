import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { LanguageService } from '../services/language.service';
import { SILENT_AUTH_CHECK } from './auth-context';

const AUTH_TOKEN_KEY = 'vinyl_auth_token';

let isHandlingSessionExpiry = false;

/**
 * Resets the session expiry throttle flag. Mainly used for unit testing.
 */
export const resetSessionExpiryThrottle = (): void => {
  isHandlingSessionExpiry = false;
};

const isPublicAuthEndpoint = (url: string): boolean => {
  return (
    url.includes('/api/users/login') ||
    url.includes('/api/users/register') ||
    url.includes('/api/users/reset-password') ||
    url.includes('/api/users/logout')
  );
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const startTime = Date.now();
  const silentAuthCheck = req.context.get(SILENT_AUTH_CHECK);

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
          const expectedAnonymous =
            silentAuthCheck && (error.status === 401 || error.status === 403);

          if (!expectedAnonymous) {
            console.error(
              `[API Error] ${req.method} ${req.url} - Status: ${error.status} - Time: ${duration}ms - Error: ${error.message}`
            );
          }

          if ((error.status === 401 || error.status === 403) && !isPublicAuthEndpoint(req.url)) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            try {
              const authService = injector.get(AuthService, null, { optional: true });
              authService?.clearSession();
            } catch {
              // Ignore DI resolution issues in isolated tests
            }

            // The startup check without a session is expected: no toast, no redirect
            if (expectedAnonymous) return;

            if (!isHandlingSessionExpiry) {
              isHandlingSessionExpiry = true;
              setTimeout(() => {
                isHandlingSessionExpiry = false;
              }, 2000);

              try {
                const toastService = injector.get(ToastService, null, { optional: true });
                const languageService = injector.get(LanguageService, null, { optional: true });
                const message = languageService
                  ? languageService.translate('auth.sessionExpired')
                  : 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
                toastService?.showToast(message, 'error');
              } catch {
                // Ignore
              }

              try {
                const router = injector.get(Router, null, { optional: true });
                router?.navigate(['/login']);
              } catch {
                // Ignore
              }
            }
          }
        }
      },
    })
  );
};

