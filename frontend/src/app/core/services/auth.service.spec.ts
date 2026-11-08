import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { User } from '../types';

/** Lets the promise chain of the start-up session check settle. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('AuthService', () => {
  let api: {
    getUser: ReturnType<typeof vi.fn>;
    loginUser: ReturnType<typeof vi.fn>;
    registerUser: ReturnType<typeof vi.fn>;
    logoutUser: ReturnType<typeof vi.fn>;
    forceSyncCollection: ReturnType<typeof vi.fn>;
    resetAllListens: ReturnType<typeof vi.fn>;
    updateDiscogsSettings: ReturnType<typeof vi.fn>;
  };
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    api = {
      getUser: vi.fn().mockName('ApiService.getUser').mockReturnValue(of({ id: 1, username: 'user' })),
      loginUser: vi.fn().mockName('ApiService.loginUser'),
      registerUser: vi.fn().mockName('ApiService.registerUser'),
      logoutUser: vi.fn().mockName('ApiService.logoutUser').mockReturnValue(of(undefined)),
      forceSyncCollection: vi.fn().mockName('ApiService.forceSyncCollection'),
      resetAllListens: vi.fn().mockName('ApiService.resetAllListens'),
      updateDiscogsSettings: vi.fn().mockName('ApiService.updateDiscogsSettings'),
    };
    toast = { showToast: vi.fn().mockName('ToastService.showToast') };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('checks the session through /users/me without a stored token (cookie session)', async () => {
    const service = TestBed.inject(AuthService);
    await settle();

    expect(api.getUser).toHaveBeenCalledWith(true);
    expect(service.user()).toEqual({ id: 1, username: 'user' });
    expect(service.isCheckingSession()).toBe(false);
    expect(service.isLoading()).toBe(false);
  });

  it('does not block the login form while the start-up check is still running', () => {
    const pending = new Subject<User>();
    api.getUser.mockReturnValue(pending.asObservable());

    const service = TestBed.inject(AuthService);

    expect(service.isCheckingSession()).toBe(true);
    expect(service.isLoading()).toBe(false);

    pending.next({ id: 1, username: 'user' });
    pending.complete();
  });

  it('treats a failed start-up check as signed out and drops a stale token', async () => {
    localStorage.setItem('vinyl_auth_token', 'stale-token');
    api.getUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const service = TestBed.inject(AuthService);
    await settle();

    expect(service.user()).toBeNull();
    expect(localStorage.getItem('vinyl_auth_token')).toBeNull();
    expect(service.isCheckingSession()).toBe(false);
  });

  it('keeps the token when the start-up check fails without a 401/403', async () => {
    localStorage.setItem('vinyl_auth_token', 'valid-token');
    api.getUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    const service = TestBed.inject(AuthService);
    await settle();

    expect(service.user()).toBeNull();
    expect(localStorage.getItem('vinyl_auth_token')).toBe('valid-token');
  });

  it('retries without a stale token so a valid cookie session signs the user in', async () => {
    localStorage.setItem('vinyl_auth_token', 'stale-token');
    api.getUser
      .mockImplementationOnce(() => {
        // The interceptor drops the rejected Bearer token before the retry
        localStorage.removeItem('vinyl_auth_token');
        return throwError(() => new HttpErrorResponse({ status: 401 }));
      })
      .mockImplementationOnce(() => of({ id: 3, username: 'cookie-user' }));

    const service = TestBed.inject(AuthService);
    await settle();
    await settle();

    expect(api.getUser).toHaveBeenCalledTimes(2);
    expect(service.user()?.id).toBe(3);
  });

  it('stores the token returned by the login', async () => {
    api.loginUser.mockReturnValue(of({ id: 2, username: 'user2', token: 'jwt-token' }));

    const service = TestBed.inject(AuthService);
    await settle();
    await service.login('user2', 'password');

    expect(localStorage.getItem('vinyl_auth_token')).toBe('jwt-token');
    expect(service.user()?.id).toBe(2);
  });

  it('clears the local session on logout even if the request fails', async () => {
    api.logoutUser.mockReturnValue(throwError(() => new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const service = TestBed.inject(AuthService);
    await settle();
    localStorage.setItem('vinyl_auth_token', 'jwt-token');

    await service.logout();

    expect(service.user()).toBeNull();
    expect(localStorage.getItem('vinyl_auth_token')).toBeNull();
  });
});
