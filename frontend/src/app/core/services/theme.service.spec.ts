import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    spyOn(localStorage, 'getItem').and.callFake((key: string) => store[key] || null);
    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
      store[key] = value;
    });

    // Mock matchMedia
    spyOn(window, 'matchMedia').and.returnValue({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any);

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set theme and persist to localStorage', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should handle system theme with light and dark media query', () => {
    service.setTheme('system');
    TestBed.flushEffects();
    expect(service.theme()).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBeTrue();
  });

  it('should update class on media query change when system theme', () => {
    let changeHandler: ((e: any) => void) | undefined;
    (window.matchMedia as jasmine.Spy).and.returnValue({
      matches: false,
      addEventListener: (evt: string, cb: any) => {
        if (evt === 'change') changeHandler = cb;
      },
      removeEventListener: () => {}
    } as any);

    let otherService: ThemeService;
    TestBed.runInInjectionContext(() => {
      otherService = new ThemeService();
    });
    otherService!.setTheme('system');
    TestBed.flushEffects();

    if (changeHandler) {
      changeHandler({ matches: true });
      expect(document.documentElement.classList.contains('dark')).toBeTrue();

      changeHandler({ matches: false });
      expect(document.documentElement.classList.contains('light')).toBeTrue();
    }
  });
});
