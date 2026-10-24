import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../core/pipes/localized-date.pipe';
import { LabelCandidate, LabelMatchConfidence, LabelPhoto } from '../../core/types';

const CONFIDENCE_CLASSES: Record<LabelMatchConfidence, string> = {
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/**
 * One photo of the label inbox with the state of its automatic identification and, once done,
 * the suggested pressing plus alternatives to choose from.
 */
@Component({
  selector: 'app-label-photo-card',
  standalone: true,
  imports: [TranslatePipe, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let taken = (photo().createdAt | localizedDate: 'short') ?? '';
    <article
      class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row"
      data-testid="label-inbox-photo"
    >
      <a
        [href]="imageUrl()"
        target="_blank"
        rel="noopener"
        class="block sm:w-48 shrink-0 aspect-square bg-slate-100 dark:bg-slate-900"
      >
        <img
          [src]="imageUrl()"
          [alt]="'labelInbox.photoAlt' | translate: { date: taken }"
          loading="lazy"
          class="w-full h-full object-cover"
        />
      </a>

      <div class="flex-1 min-w-0 p-3 flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ taken }}</span>
          <button
            type="button"
            data-testid="label-inbox-delete"
            (click)="delete.emit()"
            [disabled]="busy()"
            [attr.aria-label]="'labelInbox.deletePhoto' | translate: { date: taken }"
            class="px-2 py-1 rounded-md text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
          >
            {{ 'labelInbox.delete' | translate }}
          </button>
        </div>

        @switch (photo().identifyState) {
          @case ('queued')
          @case ('running') {
            <p class="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300" role="status" data-testid="label-photo-identifying">
              <span class="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
              {{ 'labelInbox.identifying' | translate }}
            </p>
          }
          @case ('error') {
            <p class="text-sm text-red-700 dark:text-red-300" data-testid="label-photo-error">
              {{ 'labelInbox.identifyError' | translate: { message: photo().identifyError ?? '' } }}
            </p>
            @if (canIdentify()) {
              <div>
                <button type="button" (click)="identify.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-identify">
                  {{ 'labelInbox.retryIdentify' | translate }}
                </button>
              </div>
            }
          }
          @case ('done') {
            @if (selected(); as candidate) {
              <div class="space-y-3" data-testid="label-photo-suggestion">
                <fieldset class="space-y-2">
                  <legend class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    {{ 'labelInbox.suggestion' | translate }}
                  </legend>
                  @for (option of candidates(); track option.discogsId) {
                    @if ($index === 1) {
                      <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">{{ 'labelInbox.alternatives' | translate }}</p>
                    }
                    <label
                      class="flex gap-3 p-2 rounded-lg border cursor-pointer"
                      [class]="option.discogsId === selectedId() ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'"
                    >
                      <input
                        type="radio"
                        class="mt-1"
                        [name]="'candidate-' + photo().id"
                        [checked]="option.discogsId === selectedId()"
                        (change)="selectedId.set(option.discogsId)"
                      />
                      @if (option.thumbUrl) {
                        <img [src]="option.thumbUrl" alt="" class="w-12 h-12 rounded object-cover shrink-0" loading="lazy" />
                      }
                      <span class="min-w-0 text-sm">
                        <span class="block font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {{ option.artist }} – {{ option.title }}
                        </span>
                        <span class="block text-xs text-slate-500 dark:text-slate-400">
                          {{ details(option) }} · Discogs {{ option.discogsId }}
                        </span>
                        <span class="flex flex-wrap gap-1.5 mt-1">
                          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" [class]="confidenceClass(option)">
                            {{ 'labelInbox.confidence.' + option.confidence | translate }}
                          </span>
                          @if (option.inCollection) {
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                              {{ 'labelInbox.inCollection' | translate }}
                            </span>
                          }
                        </span>
                        <span class="block text-xs text-slate-600 dark:text-slate-300 mt-1">{{ option.reason }}</span>
                      </span>
                    </label>
                  }
                </fieldset>
                @if (photo().suggestion?.hint; as hint) {
                  <p class="text-xs text-amber-700 dark:text-amber-300">💡 {{ hint }}</p>
                }
                <div class="flex flex-wrap gap-2">
                  <button type="button" (click)="add.emit(candidate)" [disabled]="busy()" data-testid="label-photo-add"
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                    {{ (candidate.inCollection ? 'labelInbox.addCopy' : 'labelInbox.add') | translate }}
                  </button>
                  <button type="button" (click)="complete.emit(candidate)" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-complete">
                    {{ 'labelInbox.complete' | translate }}
                  </button>
                  @if (canIdentify()) {
                    <button type="button" (click)="identify.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-identify">
                      {{ 'labelInbox.retryIdentify' | translate }}
                    </button>
                  }
                </div>
                @if (photo().identifyModel; as model) {
                  <p class="text-[11px] text-slate-400 dark:text-slate-500">{{ 'labelInbox.model' | translate: { model } }}</p>
                }
              </div>
            }
          }
          @default {
            @if (canIdentify()) {
              <div>
                <button type="button" (click)="identify.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-identify">
                  {{ 'labelInbox.identify' | translate }}
                </button>
              </div>
            }
          }
        }
      </div>
    </article>
  `,
})
export class LabelPhotoCardComponent {
  readonly photo = input.required<LabelPhoto>();
  readonly imageUrl = input.required<string>();
  readonly busy = input(false);
  /** Whether an OpenRouter key is configured, so (re)identifying is possible. */
  readonly canIdentify = input(false);

  readonly delete = output<void>();
  readonly identify = output<void>();
  readonly add = output<LabelCandidate>();
  readonly complete = output<LabelCandidate>();

  readonly secondaryButton =
    'px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50';

  readonly candidates = computed<LabelCandidate[]>(() => {
    const suggestion = this.photo().suggestion;
    return suggestion ? [suggestion.best, ...suggestion.alternatives] : [];
  });
  /** ID of the best match; a computed, so refreshed photo objects with the same match do not reset the choice. */
  private readonly bestId = computed(() => this.photo().suggestion?.best.discogsId ?? null);
  /** Chosen pressing; follows the best match only when a different suggestion arrives. */
  readonly selectedId = linkedSignal(() => this.bestId());
  readonly selected = computed(() => this.candidates().find((c) => c.discogsId === this.selectedId()) ?? null);

  details(candidate: LabelCandidate): string {
    return [candidate.label, candidate.catno, candidate.country, candidate.year].filter(Boolean).join(' · ');
  }

  confidenceClass(candidate: LabelCandidate): string {
    return CONFIDENCE_CLASSES[candidate.confidence];
  }
}
