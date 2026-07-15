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

  it('should read initial theme from localStorage', () => {
    store['theme'] = 'light';
    let otherService: ThemeService;
    TestBed.runInInjectionContext(() => {
      otherService = new ThemeService();
    });
    expect(otherService!.theme()).toBe('light');
  });
});
