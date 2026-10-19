import type { MockedObject } from "vitest";
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor, resetSessionExpiryThrottle } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { LanguageService } from '../services/language.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let mockRouter: MockedObject<Router>;
  let mockAuthService: MockedObject<AuthService>;
  let mockToastService: MockedObject<ToastService>;

  beforeEach(() => {
    resetSessionExpiryThrottle();

    mockRouter = {
      navigate: vi.fn().mockName("Router.navigate")
    } as unknown as MockedObject<Router>;
    mockAuthService = {
      clearSession: vi.fn().mockName("AuthService.clearSession")
    } as unknown as MockedObject<AuthService>;
    mockToastService = {
      showToast: vi.fn().mockName("ToastService.showToast")
    } as unknown as MockedObject<ToastService>;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        LanguageService,
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.removeItem('vinyl_auth_token');
  });

  afterEach(() => {
    httpMock.verify();
    resetSessionExpiryThrottle();
  });

  it('should not add Authorization header if token is not present', () => {
    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should add Authorization header if token is present', () => {
    localStorage.setItem('vinyl_auth_token', 'my-dummy-token');

    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-dummy-token');
    req.flush({});
  });

  it('should log request latency on success', () => {
    vi.spyOn(console, 'info').mockReturnValue(undefined);
    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    req.flush({});

    expect(console.info).toHaveBeenCalled();
  });

  it('should log request latency and error on failure', () => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
    httpClient.get('/api/test').subscribe({ error: () => { } });

    const req = httpMock.expectOne('/api/test');
    req.error(new ErrorEvent('Network error'), { status: 500 });

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle 401 error: clear token, clear user session, show toast, and redirect to /login', () => {
    localStorage.setItem('vinyl_auth_token', 'expired-token');

    httpClient.get('/api/collection').subscribe({ error: () => { } });

    const req = httpMock.expectOne('/api/collection');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('vinyl_auth_token')).toBeNull();
    expect(mockAuthService.clearSession).toHaveBeenCalled();
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringMatching(/abgelaufen|expired/i), 'error');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should handle 403 error: clear token, clear user session, show toast, and redirect to /login', () => {
    localStorage.setItem('vinyl_auth_token', 'forbidden-token');

    httpClient.get('/api/analytics/recent').subscribe({ error: () => { } });

    const req = httpMock.expectOne('/api/analytics/recent');
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(localStorage.getItem('vinyl_auth_token')).toBeNull();
    expect(mockAuthService.clearSession).toHaveBeenCalled();
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringMatching(/abgelaufen|expired/i), 'error');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should not redirect or clear session on 401/403 for public login endpoint', () => {
    httpClient.post('/api/users/login', { username: 'test', password: 'wrong' }).subscribe({ error: () => { } });

    const req = httpMock.expectOne('/api/users/login');
    req.flush('Bad credentials', { status: 401, statusText: 'Unauthorized' });

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToastService.showToast).not.toHaveBeenCalled();
    expect(mockAuthService.clearSession).not.toHaveBeenCalled();
  });

  it('should not redirect or clear session on 401/403 for public register endpoint', () => {
    httpClient.post('/api/users/register', { username: 'test', password: 'pwd' }).subscribe({ error: () => { } });

    const req = httpMock.expectOne('/api/users/register');
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToastService.showToast).not.toHaveBeenCalled();
    expect(mockAuthService.clearSession).not.toHaveBeenCalled();
  });

  it('should throttle duplicate session expiration alerts from multiple requests', () => {
    httpClient.get('/api/endpoint-1').subscribe({ error: () => { } });
    httpClient.get('/api/endpoint-2').subscribe({ error: () => { } });

    const req1 = httpMock.expectOne('/api/endpoint-1');
    const req2 = httpMock.expectOne('/api/endpoint-2');

    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    req2.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    expect(mockToastService.showToast).toHaveBeenCalledTimes(1);
  });
});
