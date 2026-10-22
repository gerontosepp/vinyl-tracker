import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { AppResumeService, STALE_AFTER_MS } from './app-resume.service';

describe('AppResumeService', () => {
  let service: AppResumeService;
  let visibility: DocumentVisibilityState;
  let resumed: number;
  let now: number;

  const setVisibility = (state: DocumentVisibilityState) => {
    visibility = state;
    TestBed.inject(DOCUMENT).dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    const document = TestBed.inject(DOCUMENT);
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    service = TestBed.inject(AppResumeService);
    resumed = 0;
    service.resumed$.subscribe(() => resumed++);
  });

  afterEach(() => vi.restoreAllMocks());

  it('notifies after the app was hidden long enough', () => {
    setVisibility('hidden');
    now += STALE_AFTER_MS;
    setVisibility('visible');
    expect(resumed).toBe(1);
  });

  it('ignores quick app switches', () => {
    setVisibility('hidden');
    now += STALE_AFTER_MS - 1;
    setVisibility('visible');
    expect(resumed).toBe(0);
  });

  it('ignores becoming visible without having been hidden', () => {
    setVisibility('visible');
    expect(resumed).toBe(0);
  });
});
