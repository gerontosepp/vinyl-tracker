import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { LanguageService } from './language.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { ScanResult, TrackedRecord } from '../types';

export type ScannerMode = 'hardware' | 'camera' | 'hybrid';

/** Default time a logged listen stays on the scan screen before it resets (#351, #366). */
export const SCAN_RESULT_DISPLAY_DEFAULT_SECONDS = 30;
export const SCAN_RESULT_DISPLAY_MIN_SECONDS = 5;
export const SCAN_RESULT_DISPLAY_MAX_SECONDS = 120;

const SCAN_RESULT_DISPLAY_STORAGE_KEY = 'scanner_result_display_seconds';

/** Rounds to whole seconds and keeps the value inside the supported range. */
export function clampResultDisplaySeconds(value: number): number {
  if (!Number.isFinite(value)) {
    return SCAN_RESULT_DISPLAY_DEFAULT_SECONDS;
  }
  return Math.min(
    SCAN_RESULT_DISPLAY_MAX_SECONDS,
    Math.max(SCAN_RESULT_DISPLAY_MIN_SECONDS, Math.round(value)),
  );
}

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
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly apiService = inject(ApiService);

  readonly showScanner = signal<boolean>(false);
  readonly scanLogged = signal<number>(0);

  // Scanner preferences
  readonly scannerMode = signal<ScannerMode>(this.getInitialScannerMode());
  readonly soundFeedback = signal<boolean>(this.getInitialSoundFeedback());
  /** Identify mode (#294): a scan shows the record instead of logging a listen. */
  readonly identifyMode = signal<boolean>(this.getInitialIdentifyMode());
  /** How long a logged listen stays visible before the scan screen resets (#366). */
  readonly resultDisplaySeconds = signal<number>(this.getInitialResultDisplaySeconds());
  readonly resultDisplayMs = computed(() => this.resultDisplaySeconds() * 1000);

  // Captured scan events
  readonly lastScannedCode = signal<ScannedCodeEvent | null>(null);
  readonly scanTrigger = signal<{ code: string; timestamp: number } | null>(null);

  /** Listen just logged outside the scanner screen; shown by the global scan widget. */
  readonly nowPlaying = signal<TrackedRecord | null>(null);
  /** Record the user opened from the widget; the collection page consumes it. */
  readonly pendingRecordDetail = signal<TrackedRecord | null>(null);

  // Keyboard wedge buffer for HID scanner
  private keyBuffer: { char: string; time: number }[] = [];
  private bufferTimeoutId: any = null;
  private isListenerAttached = false;
  /** Bumped for every new scan so a slower, older background response cannot win. */
  private scanRequestId = 0;

  // Keystrokes seen since the last Enter, including those the buffer dropped
  // (slow gaps, "Unidentified" keys). Used to tell a failed scan from no input.
  private strayKeyCount = 0;
  private strayTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

  private getInitialIdentifyMode(): boolean {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('scanner_identify') === 'true';
    }
    return false;
  }

  setIdentifyMode(enabled: boolean): void {
    this.identifyMode.set(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('scanner_identify', enabled ? 'true' : 'false');
    }
  }

  private getInitialResultDisplaySeconds(): number {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SCAN_RESULT_DISPLAY_STORAGE_KEY);
      if (stored !== null && stored.trim() !== '') {
        const saved = Number(stored);
        if (Number.isFinite(saved)) {
          return clampResultDisplaySeconds(saved);
        }
      }
    }
    return SCAN_RESULT_DISPLAY_DEFAULT_SECONDS;
  }

  setResultDisplaySeconds(seconds: number): void {
    const normalized = clampResultDisplaySeconds(seconds);
    this.resultDisplaySeconds.set(normalized);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SCAN_RESULT_DISPLAY_STORAGE_KEY, String(normalized));
    }
  }

  setSoundFeedback(enabled: boolean): void {
    this.soundFeedback.set(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('scanner_sound', enabled ? 'true' : 'false');
    }
  }

  openScanner(): void {
    // The scanner screen shows its own result card; a visible widget would duplicate it.
    this.scanRequestId++;
    this.nowPlaying.set(null);
    this.showScanner.set(true);
  }

  closeScanner(): void {
    this.showScanner.set(false);
    // A scan the screen never got to handle must not be replayed on the next open
    this.scanTrigger.set(null);
  }

  toggleScanner(): void {
    this.showScanner.update((open) => !open);
  }

  notifyScanLogged(): void {
    this.scanLogged.update((n) => n + 1);
  }

  /** Hides the scan widget without changing the last scanned record. */
  dismissNowPlaying(): void {
    this.nowPlaying.set(null);
  }

  /** Asks the collection page to open the record behind the scan widget. */
  requestRecordDetail(record: TrackedRecord): void {
    this.pendingRecordDetail.set(record);
    this.nowPlaying.set(null);
  }

  /**
   * Returns the record requested from the widget once and clears it, so a later visit to the
   * collection does not open the same record again.
   */
  consumePendingRecordDetail(): TrackedRecord | null {
    const record = this.pendingRecordDetail();
    if (record) {
      this.pendingRecordDetail.set(null);
    }
    return record;
  }

  clearLastScannedCode(): void {
    this.lastScannedCode.set(null);
  }

  /**
   * Returns a pending scan once and clears it. The scanner screen is re-created when it is
   * closed and opened again; a leftover trigger must not log the last record a second time.
   */
  consumeScanTrigger(): { code: string; timestamp: number } | null {
    const trigger = this.scanTrigger();
    if (trigger) {
      this.scanTrigger.set(null);
    }
    return trigger;
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
      let scanAccepted = false;
      if (this.keyBuffer.length >= 3) {
        const count = this.keyBuffer.length;
        const totalDuration = this.keyBuffer[count - 1].time - this.keyBuffer[0].time;
        const avgInterval = count > 1 ? totalDuration / (count - 1) : 999;

        const isInput = this.isInputTarget(event);

        // Eyoyo EY-009P sends keys with ~10-40ms intervals.
        // Human typing is typically > 100-150ms per keystroke.
        const isScannerBurst = isInput ? avgInterval < 75 : avgInterval < 130;

        if (isScannerBurst) {
          scanAccepted = true;
          event.preventDefault();
          const rawCode = this.keyBuffer.map((b) => b.char).join('').trim();
          this.processHardwareScan(rawCode);
        }
      }
      this.notifyIfScanRejected(event, scanAccepted);
      this.keyBuffer = [];
      if (this.bufferTimeoutId) {
        clearTimeout(this.bufferTimeoutId);
        this.bufferTimeoutId = null;
      }
      return;
    }

    // Mobile keyboards may report "Unidentified"; count it so a dropped scan is noticed
    if (event.key.length === 1 || event.key === 'Unidentified') {
      this.countStrayKey();
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

  private isInputTarget(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    return (
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    );
  }

  private countStrayKey(): void {
    this.strayKeyCount++;
    if (this.strayTimeoutId) {
      clearTimeout(this.strayTimeoutId);
    }
    this.strayTimeoutId = setTimeout(() => {
      this.strayKeyCount = 0;
      this.strayTimeoutId = null;
    }, 500);
  }

  /**
   * Outside of input fields nobody types, so several keys followed by Enter
   * without an accepted scan means the scanner burst was dropped.
   */
  private notifyIfScanRejected(event: KeyboardEvent, scanAccepted: boolean): void {
    const strayKeys = this.strayKeyCount;
    this.strayKeyCount = 0;
    if (this.strayTimeoutId) {
      clearTimeout(this.strayTimeoutId);
      this.strayTimeoutId = null;
    }
    if (scanAccepted || strayKeys < 3) return;

    if (this.isInputTarget(event)) return;

    this.toastService.showToast(this.languageService.translate('scanner.notRecognized'), 'warning');
  }

  normalizeScannedCode(code: string): string {
    let clean = (code || '').trim();
    // Handle US scanner HID transmission on German QWERTZ keyboards:
    // US '-' produces 'ß', US ':' produces 'Ö'
    if (/^discogs[ß\-_]id[Ö:]/i.test(clean)) {
      clean = clean.replace(/^discogs[ß\-_]id[Ö:]/i, 'discogs-id:');
    }
    return clean;
  }

  processHardwareScan(rawCode: string): void {
    if (!rawCode) return;

    const normalizedCode = this.normalizeScannedCode(rawCode);

    const isQr =
      normalizedCode.startsWith('discogs-id:') ||
      normalizedCode.startsWith('http://') ||
      normalizedCode.startsWith('https://') ||
      normalizedCode.length > 20;
    const type: '1d' | '2d' = isQr ? '2d' : '1d';

    const eventData: ScannedCodeEvent = {
      code: normalizedCode,
      type,
      timestamp: Date.now(),
    };

    this.lastScannedCode.set(eventData);
    this.playBeep();

    const currentUrl = this.router?.url || '';
    // If currently on settings page (/settings or /profile), stay there so user can test and inspect scan
    if (currentUrl.includes('/settings') || currentUrl.includes('/profile')) {
      return;
    }

    // The scanner screen shows its own result card, so it keeps handling the scan there.
    if (this.showScanner()) {
      this.scanTrigger.set({ code: normalizedCode, timestamp: Date.now() });
      return;
    }

    // Outside the scanner the listen is logged without leaving the page and shown in the widget.
    void this.scanInBackground(normalizedCode);
  }

  /**
   * Logs a scan received while the scanner screen is closed. A plain listen stays on the current
   * page and appears in the global widget; anything that needs a decision opens the scanner.
   */
  private async scanInBackground(code: string): Promise<void> {
    const requestId = ++this.scanRequestId;
    this.nowPlaying.set(null);
    const identify = this.identifyMode();

    try {
      const result = await firstValueFrom(this.apiService.scanBarcode(code, identify));
      if (requestId !== this.scanRequestId) return;
      this.handleBackgroundResult(result, identify, code);
    } catch (error: any) {
      if (requestId !== this.scanRequestId) return;
      const errorResult = error?.error;
      if (
        errorResult &&
        typeof errorResult === 'object' &&
        ('discogsMatches' in errorResult || 'message' in errorResult)
      ) {
        this.handleBackgroundResult(errorResult as ScanResult, identify, code);
      } else {
        const message = errorResult?.message || error?.message || 'Netzwerkfehler oder Serverfehler';
        this.toastService.showToast(message, 'error');
      }
    }
  }

  private handleBackgroundResult(result: ScanResult, identify: boolean, code: string): void {
    // Identify mode and pressings that need a choice still need the scanner screen.
    if (result.success && result.record && !identify && !result.discogsMatches?.length) {
      this.nowPlaying.set(result.record);
      this.notifyScanLogged();
      return;
    }

    // A failed lookup without a choice to make is reported without leaving the page.
    if (!result.success && !result.discogsMatches?.length) {
      this.toastService.showToast(result.message || 'Netzwerkfehler oder Serverfehler', 'error');
      return;
    }

    this.openScannerWithScan(code);
  }

  private openScannerWithScan(code: string): void {
    const trigger = { code, timestamp: Date.now() };
    const currentUrl = this.router?.url || '';
    if (currentUrl !== '/' && currentUrl !== '') {
      void this.router?.navigate(['/']).then(() => {
        this.openScanner();
        this.scanTrigger.set(trigger);
      });
    } else {
      this.openScanner();
      this.scanTrigger.set(trigger);
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

