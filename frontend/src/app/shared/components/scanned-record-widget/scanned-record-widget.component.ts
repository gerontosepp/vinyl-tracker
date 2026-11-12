import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideX } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { TrackedRecord } from '../../../core/types';

/** Granularity of the rest-time countdown (also drives the progress bar). */
const TICK_MS = 100;

/**
 * Floating confirmation for a listen logged outside the scanner screen (#380). It sits above the
 * current page, hides after the configured scan display time, pauses while the user interacts with
 * it and opens the record's details on click.
 */
@Component({
  selector: 'app-scanned-record-widget',
  standalone: true,
  imports: [TranslatePipe, LucideX],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (!scannerService.showScanner() && scannerService.nowPlaying(); as record) {
      <aside
        data-testid="scan-widget"
        role="status"
        aria-live="polite"
        class="fixed z-[55] right-4 left-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] sm:left-auto sm:right-6 sm:w-96 md:right-8 md:bottom-8 rounded-2xl border border-slate-200/80 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 backdrop-blur shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
        (mouseenter)="pause()"
        (mouseleave)="resume()"
        (focusin)="pause()"
        (focusout)="onFocusOut($event)"
        (touchstart)="pause()"
      >
        <div class="flex items-center gap-3 p-3 pr-2">
          <button
            type="button"
            data-testid="scan-widget-open"
            (click)="openRecord(record)"
            [attr.aria-label]="('scanWidget.openDetails' | translate) + ': ' + record.title"
            class="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span
              class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center"
            >
              @if (record.thumbUrl) {
                <img
                  [src]="apiService.getProxiedImageUrl(record.thumbUrl)"
                  alt=""
                  class="h-full w-full object-cover"
                />
              } @else {
                <span class="text-xl opacity-50 grayscale" aria-hidden="true">💿</span>
              }
            </span>
            <span class="min-w-0">
              <span
                class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {{ 'scanWidget.nowPlaying' | translate }}
              </span>
              <span class="block truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                {{ record.title }}
              </span>
              <span class="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ record.artist }}
              </span>
            </span>
          </button>

          <button
            type="button"
            data-testid="scan-widget-close"
            (click)="close()"
            [attr.aria-label]="'scanWidget.close' | translate"
            class="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <svg lucideX [size]="16"></svg>
          </button>
        </div>

        <div class="h-1 bg-slate-100 dark:bg-slate-700/60" aria-hidden="true">
          <div
            data-testid="scan-widget-progress"
            class="h-full bg-emerald-500 transition-[width] duration-100 ease-linear"
            [style.width.%]="progress()"
          ></div>
        </div>
      </aside>
    }
  `,
})
export class ScannedRecordWidgetComponent {
  readonly scannerService = inject(ScannerService);
  readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly remainingMs = signal(0);
  readonly totalMs = signal(0);
  readonly progress = computed(() => {
    const total = this.totalMs();
    return total > 0 ? Math.max(0, Math.min(100, (this.remainingMs() / total) * 100)) : 100;
  });

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  constructor() {
    effect(() => {
      if (this.scannerService.nowPlaying()) {
        this.startCountdown();
      } else {
        this.stopCountdown();
      }
    });
    this.destroyRef.onDestroy(() => this.stopCountdown());
  }

  /** Keeps the widget during interaction and lets the remaining time run afterwards. */
  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const card = event.currentTarget as HTMLElement | null;
    if (!next || !card?.contains(next)) {
      this.resume();
    }
  }

  close(): void {
    this.stopCountdown();
    this.scannerService.dismissNowPlaying();
  }

  openRecord(record: TrackedRecord): void {
    this.stopCountdown();
    this.scannerService.requestRecordDetail(record);
    void this.router.navigate(['/collection']);
  }

  private startCountdown(): void {
    this.stopCountdown();
    const duration = Math.max(1000, this.scannerService.resultDisplayMs());
    this.totalMs.set(duration);
    this.remainingMs.set(duration);
    this.paused = false;
    this.intervalId = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    if (this.paused) return;
    const next = this.remainingMs() - TICK_MS;
    if (next <= 0) {
      this.stopCountdown();
      this.scannerService.dismissNowPlaying();
    } else {
      this.remainingMs.set(next);
    }
  }

  private stopCountdown(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.paused = false;
  }
}
