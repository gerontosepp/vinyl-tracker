import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let swUpdate: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<UnrecoverableStateEvent>;
    checkForUpdate: ReturnType<typeof vi.fn>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };
  let fakeDocument: EventTarget & { visibilityState: string; location: { reload: ReturnType<typeof vi.fn> } };

  function setup(isEnabled = true): AppUpdateService {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    swUpdate = {
      isEnabled,
      versionUpdates,
      unrecoverable,
      checkForUpdate: vi.fn().mockResolvedValue(false),
      activateUpdate: vi.fn().mockResolvedValue(true),
    };
    fakeDocument = Object.assign(new EventTarget(), {
      visibilityState: 'visible',
      location: { reload: vi.fn() },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: swUpdate },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    return TestBed.inject(AppUpdateService);
  }

  const versionReady = {
    type: 'VERSION_READY',
    currentVersion: { hash: 'old' },
    latestVersion: { hash: 'new' },
  } as VersionEvent;

  it('flags a ready update', () => {
    const service = setup();
    service.init();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } } as VersionEvent);
    expect(service.updateReady()).toBe(false);

    versionUpdates.next(versionReady);
    expect(service.updateReady()).toBe(true);
  });

  it('does nothing when the service worker is disabled', () => {
    const service = setup(false);
    service.init();

    versionUpdates.next(versionReady);
    fakeDocument.dispatchEvent(new Event('visibilitychange'));

    expect(service.updateReady()).toBe(false);
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
  });

  it('checks for an update when the app returns to the foreground', () => {
    const service = setup();
    service.init();

    fakeDocument.visibilityState = 'hidden';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();

    fakeDocument.visibilityState = 'visible';
    fakeDocument.dispatchEvent(new Event('visibilitychange'));
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps running when the update check fails offline', async () => {
    const service = setup();
    swUpdate.checkForUpdate.mockRejectedValue(new Error('offline'));

    await expect(service.check()).resolves.toBeUndefined();
  });

  it('reloads immediately on an unrecoverable state', () => {
    const service = setup();
    service.init();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    expect(fakeDocument.location.reload).toHaveBeenCalled();
  });

  it('activates the update and reloads', async () => {
    const service = setup();

    await service.reload();

    expect(swUpdate.activateUpdate).toHaveBeenCalled();
    expect(fakeDocument.location.reload).toHaveBeenCalled();
  });

  it('reloads even when activating the update fails', async () => {
    const service = setup();
    swUpdate.activateUpdate.mockRejectedValue(new Error('no update'));

    await service.reload();

    expect(fakeDocument.location.reload).toHaveBeenCalled();
  });

  it('hides the hint when dismissed', () => {
    const service = setup();
    service.init();
    versionUpdates.next(versionReady);

    service.dismiss();

    expect(service.updateReady()).toBe(false);
  });
});
