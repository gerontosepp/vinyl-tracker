import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';

describe('appConfig', () => {
  let prefersDark: boolean;

  beforeEach(() => {
    prefersDark = true;
    document.documentElement.classList.remove('light', 'dark');
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { });
    // jsdom does not implement matchMedia
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: prefersDark,
      addEventListener: () => { },
      removeEventListener: () => { },
    })));
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function startApp(): Promise<void> {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    TestBed.tick();
  }

  it('applies the system theme at startup without opening the settings', async () => {
    await startApp();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('applies a saved light theme at startup', async () => {
    vi.mocked(Storage.prototype.getItem).mockImplementation((key: string) => (key === 'theme' ? 'light' : null));

    await startApp();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
