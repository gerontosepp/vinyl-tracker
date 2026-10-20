import { TestBed } from '@angular/core/testing';
import { WakeLockService } from './wake-lock.service';

describe('WakeLockService', () => {
  let service: WakeLockService;
  let request: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    release = vi.fn().mockResolvedValue(undefined);
    request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    service = TestBed.inject(WakeLockService);
  });

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
    vi.restoreAllMocks();
  });

  it('requests a screen lock once and releases it', async () => {
    await service.acquire();
    await service.acquire();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    await service.release();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('requests the lock again when the page becomes visible while active', async () => {
    await service.acquire();
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);

    await service.release();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('works silently without support or permission', async () => {
    request.mockRejectedValue(new Error('NotAllowedError'));
    await expect(service.acquire()).resolves.toBeUndefined();
    await expect(service.release()).resolves.toBeUndefined();

    delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
    await expect(service.acquire()).resolves.toBeUndefined();
    await service.release();
  });

  it('ignores errors of a lock the browser already released', async () => {
    release.mockRejectedValue(new Error('released'));
    await service.acquire();
    await expect(service.release()).resolves.toBeUndefined();
  });
});
