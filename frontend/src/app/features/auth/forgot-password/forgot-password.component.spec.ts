import type { MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let apiService: MockedObject<ApiService>;
  let toastService: MockedObject<ToastService>;
  let router: Router;

  beforeEach(async () => {
    const apiSpy = {
      resetPassword: vi.fn().mockName("ApiService.resetPassword")
    };
    const toastSpy = {
      showToast: vi.fn().mockName("ToastService.showToast")
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService) as MockedObject<ApiService>;
    toastService = TestBed.inject(ToastService) as MockedObject<ToastService>;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reject passwords shorter than 8 characters', async () => {
    component.username = 'testuser';
    component.newPassword = 'short';
    component.confirmPassword = 'short';
    component.discogsToken = 'token123';

    await component.handleSubmit();

    expect(component.error()).toBe('New password must be at least 8 characters long');
    expect(apiService.resetPassword).not.toHaveBeenCalled();
  });

  it('should reject mismatched passwords', async () => {
    component.username = 'testuser';
    component.newPassword = 'password123';
    component.confirmPassword = 'password456';
    component.discogsToken = 'token123';

    await component.handleSubmit();

    expect(component.error()).toBe('Passwords do not match');
    expect(apiService.resetPassword).not.toHaveBeenCalled();
  });

  it('should call apiService and navigate to /login on success', async () => {
    component.username = 'testuser';
    component.newPassword = 'validPassword123!';
    component.confirmPassword = 'validPassword123!';
    component.discogsToken = 'my_discogs_token_123';

    apiService.resetPassword.mockReturnValue(of({ id: 1, username: 'testuser' }));

    await component.handleSubmit();

    expect(apiService.resetPassword).toHaveBeenCalledWith('testuser', 'validPassword123!', 'my_discogs_token_123');
    expect(toastService.showToast).toHaveBeenCalledWith('Password reset successfully. Please sign in.', 'success');
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(component.error()).toBe('');
  });

  it('should display error message on API failure', async () => {
    component.username = 'testuser';
    component.newPassword = 'validPassword123!';
    component.confirmPassword = 'validPassword123!';
    component.discogsToken = 'wrong_token';

    apiService.resetPassword.mockReturnValue(throwError(() => ({
      status: 401,
      error: { detail: 'Invalid verification credentials for password reset.' },
    })));

    await component.handleSubmit();

    expect(component.error()).toBe('Invalid verification credentials for password reset.');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
