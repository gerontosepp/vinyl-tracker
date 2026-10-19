import type { Mock } from "vitest";
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => store[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      store[key] = value;
    });

    // jsdom does not implement matchMedia, so it is stubbed globally
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: () => { },
      removeEventListener: () => { }
    }));

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set theme and persist to localStorage', () => {
    service.setTheme('dark');
    TestBed.flushEffects();
    expect(service.theme()).toBe('dark');
    expect(Storage.prototype.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should handle system theme with light and dark media query', () => {
    service.setTheme('system');
    TestBed.flushEffects();
    expect(service.theme()).toBe('system');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('should update class on media query change when system theme', () => {
    let changeHandler: ((e: any) => void) | undefined;
    (window.matchMedia as Mock).mockReturnValue({
      matches: false,
      addEventListener: (evt: string, cb: any) => {
        if (evt === 'change')
          changeHandler = cb;
      },
      removeEventListener: () => { }
    } as any);

    let otherService: ThemeService;
    TestBed.runInInjectionContext(() => {
      otherService = new ThemeService();
    });
    otherService!.setTheme('system');
    TestBed.flushEffects();

    if (changeHandler) {
      changeHandler({ matches: true });
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      changeHandler({ matches: false });
      expect(document.documentElement.classList.contains('light')).toBe(true);
    }
  });
});
