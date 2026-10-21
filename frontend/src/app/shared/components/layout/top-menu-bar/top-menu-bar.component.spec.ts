import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TopMenuBarComponent } from './top-menu-bar.component';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { APP_VERSION } from '../../../../core/constants/release-info.data';

describe('TopMenuBarComponent', () => {
  let fixture: ComponentFixture<TopMenuBarComponent>;
  let component: TopMenuBarComponent;
  const language = signal<'de' | 'en'>('de');
  const mockAuthService = {
    user: signal<{ username: string } | null>({ username: 'opolm' }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const mockLanguageService = {
    language,
    setLanguage: vi.fn((lang: 'de' | 'en') => language.set(lang)),
    translate: (key: string) => key,
  };

  beforeEach(async () => {
    language.set('de');
    mockAuthService.user.set({ username: 'opolm' });
    await TestBed.configureTestingModule({
      imports: [TopMenuBarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: LanguageService, useValue: mockLanguageService },
        { provide: ScannerService, useValue: { closeScanner: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TopMenuBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the version next to the logo on mobile', () => {
    const badge: HTMLElement = fixture.nativeElement.querySelector('[data-testid="mobile-version"]');
    expect(badge.textContent?.trim()).toBe(`v${APP_VERSION}`);
    // Hidden from md, where the version sits below the username
    expect(badge.classList.contains('md:hidden')).toBe(true);
  });

  it('shows the app logo in the design of the favicon', () => {
    const logo: HTMLImageElement = fixture.nativeElement.querySelector('img[alt="Logo"]');
    expect(logo.getAttribute('src')).toBe('/favicon.svg');
  });

  it('renders nothing without a user', () => {
    mockAuthService.user.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('header')).toBeNull();
  });

  it('toggles the language', () => {
    component.toggleLanguage();
    expect(mockLanguageService.setLanguage).toHaveBeenCalledWith('en');
    component.toggleLanguage();
    expect(mockLanguageService.setLanguage).toHaveBeenLastCalledWith('de');
  });

  it('navigates to the login after logout', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.logout();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
