import { Injectable, signal, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs';

export type ScannerMode = 'hardware' | 'camera' | 'hybrid';

export interface ScannedCodeEvent {
  code: string;
  type: '1d' | '2d';
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ScannerService {
  private readonly router = inject(Router, { optional: true });

  readonly showScanner = signal<boolean>(false);
  readonly scanLogged = signal<number>(0);

  // Scanner preferences
  readonly scannerMode = signal<ScannerMode>(this.getInitialScannerMode());
  readonly soundFeedback = signal<boolean>(this.getInitialSoundFeedback());

  // Captured scan events
  readonly lastScannedCode = signal<ScannedCodeEvent | null>(null);
  readonly scanTrigger = signal<{ code: string; timestamp: number } | null>(null);

  // Keyboard wedge buffer for HID scanner
  private keyBuffer: { char: string; time: number }[] = [];
  private bufferTimeoutId: any = null;
  private isListenerAttached = false;

  constructor() {
    this.router?.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (event.url !== '/' && event.url !== '') {
          this.closeScanner();
        }
      });

    this.initKeyboardListener();
  }

  private getInitialScannerMode(): ScannerMode {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('scanner_mode') as ScannerMode;
      if (saved === 'hardware' || saved === 'camera' || saved === 'hybrid') {
        return saved;
      }
    }
    return 'hardware';
  }

  private getInitialSoundFeedback(): boolean {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('scanner_sound') !== 'false';
    }
    return true;
  }

  setScannerMode(mode: ScannerMode): void {
    this.scannerMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('scanner_mode', mode);
    }
  }

  setSoundFeedback(enabled: boolean): void {
    this.soundFeedback.set(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('scanner_sound', enabled ? 'true' : 'false');
    }
  }

  openScanner(): void {
    this.showScanner.set(true);
  }

  closeScanner(): void {
    this.showScanner.set(false);
  }

  toggleScanner(): void {
    this.showScanner.update((open) => !open);
  }

  notifyScanLogged(): void {
    this.scanLogged.update((n) => n + 1);
  }

  clearLastScannedCode(): void {
    this.lastScannedCode.set(null);
  }

  initKeyboardListener(): void {
    if (this.isListenerAttached || typeof window === 'undefined') return;
    this.isListenerAttached = true;
    window.addEventListener('keydown', (event: KeyboardEvent) => this.handleKeyDown(event));
  }

  handleKeyDown(event: KeyboardEvent): void {
    // If scanner mode is camera-only, ignore global HID keystrokes
    if (this.scannerMode() === 'camera') {
      return;
    }

    if (event.key === 'Enter') {
      if (this.keyBuffer.length >= 3) {
        const count = this.keyBuffer.length;
        const totalDuration = this.keyBuffer[count - 1].time - this.keyBuffer[0].time;
        const avgInterval = count > 1 ? totalDuration / (count - 1) : 999;

        const target = event.target as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            (target as HTMLElement).isContentEditable);

        // Eyoyo EY-009P sends keys with ~10-40ms intervals.
        // Human typing is typically > 100-150ms per keystroke.
        const isScannerBurst = isInput ? avgInterval < 75 : avgInterval < 130;

        if (isScannerBurst) {
          event.preventDefault();
          const rawCode = this.keyBuffer.map((b) => b.char).join('').trim();
          this.processHardwareScan(rawCode);
        }
      }
      this.keyBuffer = [];
      if (this.bufferTimeoutId) {
        clearTimeout(this.bufferTimeoutId);
        this.bufferTimeoutId = null;
      }
      return;
    }

    // Ignore modifier and non-printable keys
    if (event.key.length !== 1) {
      return;
    }

    const now = Date.now();
    if (this.keyBuffer.length > 0) {
      const lastKeyTime = this.keyBuffer[this.keyBuffer.length - 1].time;
      if (now - lastKeyTime > 120) {
        // Exceeded inter-character delay threshold, reset buffer
        this.keyBuffer = [];
      }
    }

    this.keyBuffer.push({ char: event.key, time: now });

    if (this.bufferTimeoutId) {
      clearTimeout(this.bufferTimeoutId);
    }
    this.bufferTimeoutId = setTimeout(() => {
      this.keyBuffer = [];
    }, 150);
  }

  processHardwareScan(rawCode: string): void {
    if (!rawCode) return;

    const isQr =
      rawCode.startsWith('discogs-id:') ||
      rawCode.startsWith('http://') ||
      rawCode.startsWith('https://') ||
      rawCode.length > 20;
    const type: '1d' | '2d' = isQr ? '2d' : '1d';

    const eventData: ScannedCodeEvent = {
      code: rawCode,
      type,
      timestamp: Date.now(),
    };

    this.lastScannedCode.set(eventData);
    this.playBeep();

    const currentUrl = this.router?.url || '';
    // If currently on settings page, stay there so user can test and inspect scan
    if (currentUrl.includes('/settings')) {
      return;
    }

    // On other pages (or dashboard), activate scanner view and trigger scan
    if (currentUrl !== '/' && currentUrl !== '') {
      this.router?.navigate(['/']).then(() => {
        this.openScanner();
        this.scanTrigger.set({ code: rawCode, timestamp: Date.now() });
      });
    } else {
      this.openScanner();
      this.scanTrigger.set({ code: rawCode, timestamp: Date.now() });
    }
  }

  playBeep(): void {
    if (!this.soundFeedback() || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // AudioContext blocked or unsupported
    }
  }
}

