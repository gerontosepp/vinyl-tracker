import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Brings a new deployment to an installed PWA. The service worker serves the cached version
 * first, so the app checks for an update whenever it comes back to the foreground and offers a
 * reload once the new version is ready. A broken service worker state reloads immediately.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);

  readonly updateReady = signal(false);

  init(): void {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.updateReady.set(true);
    });
    this.swUpdate.unrecoverable.subscribe(() => this.document.location.reload());
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.check();
    });
  }

  async check(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Offline or server unreachable: keep running the cached version
    }
  }

  async reload(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } catch {
      // The reload below loads the new version anyway
    }
    this.document.location.reload();
  }

  dismiss(): void {
    this.updateReady.set(false);
  }
}
