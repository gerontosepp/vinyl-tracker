import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { WakeLockService } from '../../core/services/wake-lock.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { getErrorMessage } from '../../core/utils/error';
import { StorageMedia, StorageSequenceItem } from '../../core/types';
import { compartmentProgress, isNewCompartment, startIndex } from './sort-sequence';

interface SortShelf {
  id: number;
  name: string;
  media: StorageMedia;
  rows: number;
  columns: number;
}

/**
 * Sort mode for phones: shows the collection copy by copy in shelf order, starting at a chosen
 * compartment, so a stack of records can be put on the shelves in the right order.
 */
@Component({
  selector: 'app-sort-mode',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      @switch (state()) {
        @case ('setup') {
          <div class="flex-1 flex flex-col max-w-md w-full mx-auto gap-5" data-testid="sort-setup">
            <div>
              <h1 class="text-2xl font-bold tracking-tight">{{ 'sort.title' | translate }}</h1>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ 'sort.intro' | translate }}</p>
            </div>

            @if (loading()) {
              <p class="text-sm text-slate-500">{{ 'sort.loading' | translate }}</p>
            } @else if (shelves().length === 0) {
              <p class="text-sm font-semibold text-amber-700 dark:text-amber-300" data-testid="sort-no-shelves">
                {{ 'sort.noShelves' | translate }}
              </p>
            } @else {
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                {{ 'sort.shelf' | translate }}
                <select
                  name="shelf"
                  [ngModel]="shelfId()"
                  (ngModelChange)="shelfId.set(+$event)"
                  data-testid="sort-shelf"
                  [class]="inputClass"
                >
                  @for (shelf of shelves(); track shelf.id) {
                    <option [value]="shelf.id">{{ shelf.name }} · {{ 'storage.media.' + shelf.media | translate }}</option>
                  }
                </select>
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'sort.row' | translate }}
                  <input
                    type="number"
                    inputmode="numeric"
                    name="row"
                    min="1"
                    [max]="shelf()?.rows ?? 1"
                    [ngModel]="row()"
                    (ngModelChange)="row.set(+$event)"
                    data-testid="sort-row"
                    [class]="inputClass"
                    [class.border-red-500]="!rowValid()"
                  />
                </label>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'sort.column' | translate }}
                  <input
                    type="number"
                    inputmode="numeric"
                    name="column"
                    min="1"
                    [max]="shelf()?.columns ?? 1"
                    [ngModel]="column()"
                    (ngModelChange)="column.set(+$event)"
                    data-testid="sort-column"
                    [class]="inputClass"
                    [class.border-red-500]="!columnValid()"
                  />
                </label>
              </div>
              @if (shelf(); as s) {
                <p class="text-xs" [class]="startValid() ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400 font-semibold'" data-testid="sort-grid-hint">
                  {{ 'sort.gridHint' | translate: { rows: s.rows, columns: s.columns } }}
                </p>
              }
            }

            <div class="mt-auto flex flex-col gap-3">
              @if (shelves().length > 0) {
                <button
                  type="button"
                  (click)="start()"
                  [disabled]="!startValid() || starting()"
                  data-testid="sort-start"
                  class="w-full h-16 rounded-2xl bg-indigo-600 disabled:opacity-50 text-white text-xl font-bold cursor-pointer"
                >
                  {{ 'sort.start' | translate }}
                </button>
              }
              <button type="button" (click)="end()" data-testid="sort-cancel" class="w-full py-3 rounded-xl text-slate-600 dark:text-slate-300 font-bold cursor-pointer">
                {{ 'sort.end' | translate }}
              </button>
            </div>
          </div>
        }

        @case ('sorting') {
          @if (current(); as item) {
            <div class="flex-1 flex flex-col max-w-md w-full mx-auto gap-4" data-testid="sort-screen">
              <div
                class="rounded-2xl px-4 py-3 text-center transition-colors"
                [class]="newCompartment() ? 'bg-amber-400 text-slate-900 shadow-lg' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'"
                data-testid="sort-compartment"
              >
                @if (newCompartment()) {
                  <p class="text-xs font-black uppercase tracking-widest" data-testid="sort-new-compartment">{{ 'sort.newCompartment' | translate }}</p>
                }
                <p class="text-2xl font-black" data-testid="sort-slot">{{ slotLabel(item) || ('storage.unplaced' | translate) }}</p>
                <p class="text-sm font-semibold" [class.text-slate-500]="!newCompartment()" [class.dark:text-slate-400]="!newCompartment()" data-testid="sort-progress">
                  {{ progress().position }} / {{ progress().total }}
                </p>
              </div>

              <div class="flex-1 flex flex-col items-center justify-center gap-3 min-h-0">
                @if (coverUrl(item); as url) {
                  <img [src]="url" alt="" class="w-full max-w-[18rem] aspect-square object-cover rounded-xl shadow-md bg-slate-200 dark:bg-slate-800" />
                } @else {
                  <div class="w-full max-w-[18rem] aspect-square rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-5xl" aria-hidden="true">💿</div>
                }
                <div class="text-center">
                  <p class="text-xl font-bold leading-tight" data-testid="sort-title">{{ item.title }}</p>
                  <p class="text-base text-slate-600 dark:text-slate-300" data-testid="sort-artist">{{ item.artist ?? ('sort.unknownArtist' | translate) }}</p>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    (click)="back()"
                    [disabled]="index() <= startAt()"
                    data-testid="sort-back"
                    class="py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    {{ 'sort.back' | translate }}
                  </button>
                  <button
                    type="button"
                    (click)="end()"
                    data-testid="sort-end"
                    class="py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    {{ 'sort.end' | translate }}
                  </button>
                </div>
                <button
                  type="button"
                  (click)="next()"
                  data-testid="sort-next"
                  class="w-full h-24 rounded-2xl bg-indigo-600 active:bg-indigo-700 text-white text-3xl font-black shadow-lg cursor-pointer"
                >
                  {{ 'sort.next' | translate }}
                </button>
              </div>
            </div>
          }
        }

        @case ('done') {
          <div class="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto gap-6 text-center" data-testid="sort-done">
            <p class="text-6xl" aria-hidden="true">✅</p>
            <div>
              <h1 class="text-2xl font-bold">{{ 'sort.doneTitle' | translate }}</h1>
              <p class="text-slate-600 dark:text-slate-300 mt-1" data-testid="sort-done-count">
                {{ 'sort.doneText' | translate: { count: sortedCount() } }}
              </p>
            </div>
            <button type="button" (click)="end()" data-testid="sort-home" class="w-full h-16 rounded-2xl bg-indigo-600 text-white text-xl font-bold cursor-pointer">
              {{ 'sort.home' | translate }}
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class SortModeComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly wakeLock = inject(WakeLockService);

  readonly inputClass =
    'mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-xl py-3 px-3 bg-white dark:bg-slate-800 text-lg font-semibold outline-none focus:ring-2 focus:ring-indigo-500/50';

  readonly state = signal<'setup' | 'sorting' | 'done'>('setup');
  readonly loading = signal(true);
  readonly starting = signal(false);

  readonly shelves = signal<SortShelf[]>([]);
  readonly shelfId = signal<number | null>(null);
  readonly row = signal(1);
  readonly column = signal(1);

  readonly items = signal<StorageSequenceItem[]>([]);
  readonly startAt = signal(0);
  readonly index = signal(0);
  readonly sortedCount = signal(0);

  readonly shelf = computed(() => this.shelves().find((s) => s.id === this.shelfId()) ?? null);
  readonly rowValid = computed(() => this.inRange(this.row(), this.shelf()?.rows));
  readonly columnValid = computed(() => this.inRange(this.column(), this.shelf()?.columns));
  readonly startValid = computed(() => this.shelf() !== null && this.rowValid() && this.columnValid());

  readonly current = computed(() => this.items()[this.index()] ?? null);
  readonly progress = computed(() =>
    this.current() ? compartmentProgress(this.items(), this.index()) : { position: 0, total: 0 }
  );
  readonly newCompartment = computed(
    () => this.current() !== null && isNewCompartment(this.items(), this.index(), this.startAt())
  );

  constructor() {
    // Preload the next cover so "Next" shows it without delay
    effect(() => {
      const next = this.items()[this.index() + 1];
      const url = next ? this.coverUrl(next) : null;
      if (url) new Image().src = url;
    });
  }

  ngOnInit(): void {
    this.api.getStorageLayout().subscribe({
      next: (layout) => {
        const shelves = layout.media.flatMap((m) =>
          m.units.map((u) => ({ id: u.id, name: u.name, media: m.media, rows: u.rows, columns: u.columns }))
        );
        this.shelves.set(shelves);
        this.shelfId.set(shelves[0]?.id ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.showToast(getErrorMessage(err, 'Regale konnten nicht geladen werden'), 'error');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    void this.wakeLock.release();
  }

  start(): void {
    const shelf = this.shelf();
    if (!shelf || !this.startValid()) return;
    this.starting.set(true);
    this.api.getStorageSequence(shelf.media).subscribe({
      next: (sequence) => {
        this.starting.set(false);
        const order = this.shelves()
          .filter((s) => s.media === shelf.media)
          .map((s) => s.id);
        const compartment = (this.row() - 1) * shelf.columns + this.column();
        const first = startIndex(sequence.items, order, shelf.id, compartment);
        this.items.set(sequence.items);
        if (first < 0) {
          this.sortedCount.set(0);
          this.state.set('done');
          return;
        }
        this.startAt.set(first);
        this.index.set(first);
        this.state.set('sorting');
        void this.wakeLock.acquire();
      },
      error: (err) => {
        this.starting.set(false);
        this.toast.showToast(getErrorMessage(err, 'Reihenfolge konnte nicht geladen werden'), 'error');
      },
    });
  }

  next(): void {
    if (this.index() >= this.items().length - 1) {
      this.sortedCount.set(this.items().length - this.startAt());
      this.state.set('done');
      void this.wakeLock.release();
      return;
    }
    this.index.update((i) => i + 1);
  }

  back(): void {
    if (this.index() > this.startAt()) this.index.update((i) => i - 1);
  }

  end(): void {
    void this.wakeLock.release();
    void this.router.navigate(['/']);
  }

  slotLabel(item: StorageSequenceItem): string {
    const { slot } = item;
    return slot.unplaced || slot.unitId == null ? '' : `${slot.unitName} · ${slot.row}:${slot.column}`;
  }

  coverUrl(item: StorageSequenceItem): string | null {
    return item.thumbUrl ? this.api.getProxiedImageUrl(item.thumbUrl) : null;
  }

  private inRange(value: number, max: number | undefined): boolean {
    return Number.isInteger(value) && max !== undefined && value >= 1 && value <= max;
  }
}
