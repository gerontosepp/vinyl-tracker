import { Component, ChangeDetectionStrategy, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';
import { LucidePrinter, LucideX } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { getErrorMessage } from '../../../core/utils/error';
import { PrintFilter, PrintRequest, PrintScope, PrintTemplate } from '../../../core/types';

export type PrintScopeType = PrintScope['type'];

/** Labels per Avery 3474 sheet – valid start positions are 1..LABELS_PER_SHEET. */
export const LABELS_PER_SHEET = 24;

const TEMPLATES: PrintTemplate[] = ['avery-3474', 'scan-list', 'qr-cards'];

/**
 * Print dialog: picks template, scope and (for labels) the first free label, then downloads the
 * PDF from `POST /api/print`. Offers "selection" only with selected IDs and "filter" only with a filter.
 */
@Component({
  selector: 'app-print-dialog',
  standalone: true,
  imports: [TranslatePipe, LucidePrinter, LucideX],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="close()">
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        data-testid="print-dialog"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg lucidePrinter [size]="20" class="text-indigo-500"></svg>
            {{ 'print.title' | translate }}
          </h3>
          <button
            type="button"
            (click)="close()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            [attr.aria-label]="'print.cancel' | translate"
          >
            <svg lucideX [size]="18"></svg>
          </button>
        </div>

        <!-- Template -->
        <fieldset class="mb-5">
          <legend class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
            {{ 'print.template' | translate }}
          </legend>
          <div class="space-y-2">
            @for (tpl of templates; track tpl) {
              <label
                class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                [class]="
                  template() === tpl
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                "
              >
                <input
                  type="radio"
                  name="print-template"
                  class="mt-1 accent-indigo-600"
                  [value]="tpl"
                  [checked]="template() === tpl"
                  [attr.data-testid]="'template-' + tpl"
                  (change)="template.set(tpl)"
                />
                <span>
                  <span class="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {{ 'print.template.' + tpl | translate }}
                  </span>
                  <span class="block text-xs text-slate-500 dark:text-slate-400">
                    {{ 'print.template.' + tpl + '.desc' | translate }}
                  </span>
                </span>
              </label>
            }
          </div>
        </fieldset>

        <!-- Scope -->
        <fieldset class="mb-5">
          <legend class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
            {{ 'print.scope' | translate }}
          </legend>
          <div class="space-y-1.5">
            @for (option of scopes(); track option) {
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="print-scope"
                  class="accent-indigo-600"
                  [value]="option"
                  [checked]="scope() === option"
                  [attr.data-testid]="'scope-' + option"
                  (change)="chosenScope.set(option)"
                />
                {{ 'print.scope.' + option | translate: { count: selectedIds().length } }}
              </label>
            }
          </div>
        </fieldset>

        <!-- Start position for partially used label sheets -->
        @if (template() === 'avery-3474') {
          <div class="mb-5">
            <label for="print-start" class="block text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
              {{ 'print.startPosition' | translate }}
            </label>
            <input
              id="print-start"
              type="number"
              min="1"
              [max]="labelsPerSheet"
              [value]="startPosition()"
              (input)="onStartPositionInput($event)"
              data-testid="start-position"
              class="w-24 px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <p class="text-xs mt-1" [class]="startPositionValid() ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400'">
              {{ (startPositionValid() ? 'print.startPositionHint' : 'print.invalidStart') | translate }}
            </p>
          </div>
        }

        <!-- Labels are meant for vinyl: printing them for CDs needs an explicit confirmation -->
        @if (needsCdConfirmation()) {
          <div class="mb-5 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-3" data-testid="cd-warning">
            <p class="text-xs text-red-700 dark:text-red-300 mb-2">
              {{ cdWarningKey() | translate: { count: cdCount() ?? 0 } }}
            </p>
            <label class="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200 cursor-pointer">
              <input
                type="checkbox"
                class="accent-red-600"
                [checked]="cdConfirmed()"
                (change)="cdConfirmed.set(!cdConfirmed())"
                data-testid="cd-confirm"
              />
              {{ 'print.cdConfirm' | translate }}
            </label>
          </div>
        }

        <p class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-5">
          {{ 'print.scaleHint' | translate }}
        </p>

        <div class="flex gap-3">
          <button
            type="button"
            (click)="close()"
            class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {{ 'print.cancel' | translate }}
          </button>
          <button
            type="button"
            (click)="submit()"
            [disabled]="!canSubmit()"
            data-testid="print-submit"
            class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            {{ (isPrinting() ? 'print.printing' : 'print.submit') | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PrintDialogComponent {
  private readonly apiService = inject(ApiService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Discogs IDs of the selected records (enables scope "ids"). */
  readonly selectedIds = input<number[]>([]);
  /** Current collection filters (enables scope "filter"). */
  readonly filter = input<PrintFilter | null>(null);
  /** Whether the selection contains at least one CD. */
  readonly selectionHasCds = input<boolean>(false);
  readonly closed = output<void>();

  readonly templates = TEMPLATES;
  readonly labelsPerSheet = LABELS_PER_SHEET;

  readonly template = signal<PrintTemplate>('avery-3474');
  readonly startPosition = signal<number>(1);
  readonly isPrinting = signal<boolean>(false);
  readonly cdConfirmed = signal<boolean>(false);

  readonly scopes = computed<PrintScopeType[]>(() => {
    const scopes: PrintScopeType[] = [];
    if (this.selectedIds().length > 0) scopes.push('ids');
    if (this.filter()) scopes.push('filter');
    scopes.push('all');
    return scopes;
  });

  readonly chosenScope = signal<PrintScopeType | null>(null);
  /** Defaults to the narrowest available scope until the user picks one. */
  readonly scope = computed(() => this.chosenScope() ?? this.scopes()[0]);

  readonly startPositionValid = computed(() => {
    const value = this.startPosition();
    return Number.isInteger(value) && value >= 1 && value <= LABELS_PER_SHEET;
  });

  /**
   * Number of CDs in the "filter"/"all" scope (null while loading). Loaded from the collection
   * endpoint with category "cd" so only real CDs trigger the label confirmation.
   */
  readonly cdCount = signal<number | null>(null);
  private cdCountSub?: Subscription;

  /** Whether the chosen scope contains CDs (or might, if they could not be counted). */
  readonly scopeMayIncludeCds = computed(() => {
    if (this.scope() === 'ids') return this.selectionHasCds();
    const count = this.cdCount();
    return count !== null && count !== 0;
  });

  constructor() {
    effect(() => {
      const scope = this.scope();
      const labels = this.template() === 'avery-3474';
      const filter = scope === 'filter' ? (this.filter() ?? {}) : {};
      this.cdCountSub?.unsubscribe();
      this.cdCount.set(null);
      if (!labels || scope === 'ids') return;
      if (filter.category === 'vinyl') {
        this.cdCount.set(0);
        return;
      }
      this.cdCountSub = this.apiService
        .getCollection(
          1,
          1,
          filter.min_plays ?? 0,
          filter.sort,
          filter.sort_order,
          filter.search,
          'cd',
          filter.genres ? filter.genres.split(',') : undefined,
          filter.years,
          filter.not_played_since,
          filter.unplayed_only
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => this.cdCount.set(res.pagination?.items ?? 0),
          // If the count is unavailable, err on the side of asking for confirmation
          error: () => this.cdCount.set(-1),
        });
    });
  }

  /** Labels for a "filter"/"all" scope wait for the CD count. */
  readonly cdCheckPending = computed(
    () => this.template() === 'avery-3474' && this.scope() !== 'ids' && this.cdCount() === null
  );

  readonly needsCdConfirmation = computed(
    () => this.template() === 'avery-3474' && !this.cdCheckPending() && this.scopeMayIncludeCds()
  );

  /** Translation key of the CD warning; -1 means the count could not be loaded. */
  readonly cdWarningKey = computed(() =>
    this.scope() !== 'ids' && this.cdCount() === -1 ? 'print.cdWarning.unknown' : `print.cdWarning.${this.scope()}`
  );

  readonly canSubmit = computed(
    () =>
      !this.isPrinting() &&
      !this.cdCheckPending() &&
      (this.template() !== 'avery-3474' || this.startPositionValid()) &&
      (!this.needsCdConfirmation() || this.cdConfirmed())
  );

  onStartPositionInput(event: Event): void {
    this.startPosition.set(Number((event.target as HTMLInputElement).value));
  }

  buildRequest(): PrintRequest {
    const scopeType = this.scope();
    let scope: PrintScope;
    if (scopeType === 'ids') {
      scope = { type: 'ids', discogs_ids: this.selectedIds() };
    } else if (scopeType === 'filter') {
      scope = { type: 'filter', filter: this.filter() ?? {} };
    } else {
      scope = { type: 'all' };
    }

    const request: PrintRequest = {
      template: this.template(),
      scope,
      options: { language: this.languageService.language() },
    };
    if (this.template() === 'avery-3474' && this.startPosition() > 1) {
      request.options.start_position = this.startPosition();
    }
    return request;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const request = this.buildRequest();

    this.isPrinting.set(true);
    try {
      const blob = await firstValueFrom(this.apiService.print(request));
      this.download(blob, `vinyl_${request.template}.pdf`);
      this.toastService.showToast(this.languageService.translate('print.success'), 'success');
      this.closed.emit();
    } catch (err) {
      console.error(err);
      // The dialog stays open so the user can adjust the settings
      this.toastService.showToast(getErrorMessage(err, this.languageService.translate('print.error')), 'error');
    } finally {
      this.isPrinting.set(false);
    }
  }

  close(): void {
    if (!this.isPrinting()) {
      this.closed.emit();
    }
  }

  private download(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }
}
