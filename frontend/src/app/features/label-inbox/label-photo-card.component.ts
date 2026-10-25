import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
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
  host: { '(document:keydown.escape)': 'expanded.set(false)' },
  template: `
    @let taken = (photo().createdAt | localizedDate: 'short') ?? '';
    <article
      class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row"
      data-testid="label-inbox-photo"
    >
      @if (imageSrc(); as src) {
        <button
          type="button"
          (click)="expanded.set(true)"
          [attr.aria-label]="'labelInbox.showPhoto' | translate: { date: taken }"
          class="block sm:w-48 shrink-0 aspect-square bg-slate-100 dark:bg-slate-900 cursor-zoom-in"
          data-testid="label-photo-thumbnail"
        >
          <img [src]="src" [alt]="'labelInbox.photoAlt' | translate: { date: taken }" class="w-full h-full object-cover" />
        </button>
        @if (expanded()) {
          <div
            class="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'labelInbox.photoAlt' | translate: { date: taken }"
            (click)="expanded.set(false)"
            data-testid="label-photo-fullsize"
          >
            <img [src]="src" alt="" class="max-w-full max-h-full object-contain" />
          </div>
        }
      } @else {
        <div
          class="sm:w-48 shrink-0 aspect-square bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-500 dark:text-slate-400"
          data-testid="label-photo-image-placeholder"
        >
          @if (image.error()) {
            <span>{{ 'labelInbox.imageError' | translate }}</span>
            <button type="button" (click)="image.reload()" [class]="secondaryButton" data-testid="label-photo-image-retry">
              {{ 'labelInbox.imageRetry' | translate }}
            </button>
          } @else {
            <span class="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
          }
        </div>
      }

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
            @if (!photo().suggestion) {
              <div class="space-y-2" data-testid="label-photo-no-match">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ 'labelInbox.noMatch' | translate }}</p>
                @if (photo().identifyError; as hint) {
                  <p class="text-xs text-amber-700 dark:text-amber-300">💡 {{ hint }}</p>
                }
                <div class="flex flex-wrap gap-2">
                  <button type="button" (click)="manual.emit()" [disabled]="busy()" data-testid="label-photo-manual"
                    class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                    {{ 'manual.add' | translate }}
                  </button>
                  @if (canIdentify()) {
                    <button type="button" (click)="identify.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-identify">
                      {{ 'labelInbox.retryIdentify' | translate }}
                    </button>
                  }
                </div>
              </div>
            }
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
                  @if (candidate.confidence !== 'high') {
                    <button type="button" (click)="manual.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-manual">
                      {{ 'manual.add' | translate }}
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
            <div class="flex flex-wrap gap-2">
              @if (canIdentify()) {
                <button type="button" (click)="identify.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-identify">
                  {{ 'labelInbox.identify' | translate }}
                </button>
              }
              <button type="button" (click)="manual.emit()" [disabled]="busy()" [class]="secondaryButton" data-testid="label-photo-manual">
                {{ 'manual.add' | translate }}
              </button>
            </div>
          }
        }
      </div>
    </article>
  `,
})
export class LabelPhotoCardComponent {
  private readonly apiService = inject(ApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly photo = input.required<LabelPhoto>();
  readonly busy = input(false);
  /** Whether an OpenRouter key is configured, so (re)identifying is possible. */
  readonly canIdentify = input(false);

  readonly delete = output<void>();
  readonly identify = output<void>();
  readonly add = output<LabelCandidate>();
  readonly complete = output<LabelCandidate>();
  /** Create a manual record from this photo (no or no reliable Discogs match). */
  readonly manual = output<void>();

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

  /** Polling delivers new photo objects; only a different ID may load the photo again. */
  private readonly photoId = computed(() => this.photo().id);
  /** Set once the card scrolls into view; photos further down are only loaded when needed. */
  private readonly visible = signal(false);
  /**
   * The photo is loaded through HttpClient so the request carries the Bearer token like every
   * API call; an `<img src>` would only send the auth cookie, which expires before the token.
   */
  readonly image = httpResource.blob(() =>
    this.visible() ? this.apiService.labelPhotoImageUrl(this.photoId()) : undefined
  );
  /** Object URL of the loaded photo; created and revoked together in the effect below. */
  readonly imageSrc = signal<string | null>(null);
  readonly expanded = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.image.hasValue()) {
        this.imageSrc.set(null);
        return;
      }
      const src = URL.createObjectURL(this.image.value());
      this.imageSrc.set(src);
      // Each object URL holds the image in memory until it is revoked
      onCleanup(() => URL.revokeObjectURL(src));
    });

    // Without IntersectionObserver (old browsers, tests) every photo is loaded right away
    if (typeof IntersectionObserver === 'undefined') {
      this.visible.set(true);
      return;
    }
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            this.visible.set(true);
            observer.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  details(candidate: LabelCandidate): string {
    return [candidate.label, candidate.catno, candidate.country, candidate.year].filter(Boolean).join(' · ');
  }

  confidenceClass(candidate: LabelCandidate): string {
    return CONFIDENCE_CLASSES[candidate.confidence];
  }
}
