import { HttpContextToken } from '@angular/common/http';

/**
 * Marks the startup `GET /users/me` check. The backend also authenticates via an HttpOnly
 * cookie, so the check runs without a stored Bearer token; a 401 simply means "not signed in"
 * and must not be reported as an expired session.
 */
export const SILENT_AUTH_CHECK = new HttpContextToken<boolean>(() => false);
