import { Injectable } from '@angular/core';

/**
 * Keeps the screen on while acquired (Screen Wake Lock API). Browsers release the lock when the
 * page is hidden, so it is requested again when the page becomes visible. Without support or
 * permission it does nothing.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  private active = false;

  private readonly onVisibilityChange = (): void => {
    if (this.active && document.visibilityState === 'visible') void this.request();
  };

  async acquire(): Promise<void> {
    if (this.active) return;
    this.active = true;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    await this.request();
  }

  async release(): Promise<void> {
    this.active = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      // Already released by the browser
    }
  }

  private async request(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Not allowed (e.g. battery saver); the screen simply follows the system setting
      this.sentinel = null;
    }
  }
}
