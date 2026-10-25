import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideCopy, LucideExternalLink, LucideSearch } from '@lucide/angular';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DiscogsCandidate, RecordDetailDto, TakeoverMode, TakeoverResult } from '../../../../core/types';
import { getErrorMessage } from '../../../../core/utils/error';

/** Discogs offers no URL parameters to pre-fill this form, so the data is copied instead. */
export const DISCOGS_ADD_RELEASE_URL = 'https://www.discogs.com/release/add';

/** Text with the data of a manual record to paste into the Discogs "Add Release" form. */
export function contributionText(detail: RecordDetailDto): string {
  const label = detail.labels?.[0];
  const lines: [string, string | null | undefined][] = [
    ['Artist', detail.artist],
    ['Title', detail.title],
    ['Format', detail.format],
    ['Year', detail.year],
    ['Label', label?.name],
    ['Catalog#', label?.catno],
    ['Country', detail.country],
    ['Barcode', detail.barcode],
    ['Notes', detail.notes],
  ];
  return lines
    .filter(([, value]) => value?.trim())
    .map(([name, value]) => `${name}: ${value!.trim()}`)
    .join('\n');
}

/**
 * "Check on Discogs" for a manual record (#243): searches for its release, lets the user pick a
 * candidate and confirm the takeover (second copy or merge), or contribute the record to Discogs.
 */
@Component({
  selector: 'app-discogs-takeover',
  standalone: true,
  imports: [TranslatePipe, LucideSearch, LucideExternalLink, LucideCopy],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700" data-testid="discogs-takeover">
      <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {{ 'takeover.title' | translate }}
      </h3>

      @if (selected(); as candidate) {
        <div class="space-y-3" data-testid="takeover-confirm">
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ 'takeover.confirmTitle' | translate }}</p>
          <p class="text-xs text-slate-600 dark:text-slate-300">
            {{ 'takeover.confirmText' | translate: { release: releaseName(candidate), id: candidate.discogsId } }}
          </p>
          @if (candidate.inCollection.length > 0) {
            <fieldset class="space-y-2">
              @for (option of modes; track option) {
                <label class="flex gap-2 p-2 rounded-lg border cursor-pointer text-sm"
                  [class]="mode() === option ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'">
                  <input type="radio" name="takeover-mode" class="mt-1" [checked]="mode() === option" (change)="mode.set(option)"
                    [attr.data-testid]="'takeover-mode-' + option" />
                  <span>
                    <span class="block font-semibold text-slate-900 dark:text-slate-100">{{ modeLabel(option) | translate }}</span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400">{{ modeHint(option) | translate }}</span>
                  </span>
                </label>
              }
            </fieldset>
            @if (mode() === 'merge' && candidate.inCollection.length > 1) {
              <label class="block text-xs text-slate-600 dark:text-slate-300">
                {{ 'takeover.target' | translate }}
                <select class="mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                  data-testid="takeover-target" (change)="targetId.set(+$any($event.target).value)">
                  @for (instance of candidate.inCollection; track instance) {
                    <option [value]="instance" [selected]="instance === targetId()">
                      {{ 'takeover.targetOption' | translate: { id: instance } }}
                    </option>
                  }
                </select>
              </label>
            }
          }
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="confirm()" [disabled]="running()" data-testid="takeover-submit"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              {{ (running() ? 'takeover.running' : 'takeover.confirm') | translate }}
            </button>
            <button type="button" (click)="selected.set(null)" [disabled]="running()" [class]="secondaryButton" data-testid="takeover-back">
              {{ 'takeover.back' | translate }}
            </button>
          </div>
        </div>
      } @else {
        <p class="text-xs text-slate-600 dark:text-slate-300">{{ 'takeover.intro' | translate }}</p>

        @if (candidates(); as list) {
          @if (list.length === 0) {
            <p class="text-sm text-slate-500 dark:text-slate-400" data-testid="takeover-no-match">{{ 'takeover.noMatch' | translate }}</p>
          } @else {
            <div class="space-y-2" data-testid="takeover-candidates">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">{{ 'takeover.candidates' | translate }}</p>
              @for (option of list; track option.discogsId) {
                <div class="flex gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  @if (option.thumbUrl) {
                    <img [src]="option.thumbUrl" alt="" class="w-12 h-12 rounded object-cover shrink-0" loading="lazy" />
                  }
                  <div class="min-w-0 flex-1 text-sm">
                    <span class="block font-semibold text-slate-900 dark:text-slate-100 truncate">{{ releaseName(option) }}</span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400">{{ details(option) }} · Discogs {{ option.discogsId }}</span>
                    <span class="flex flex-wrap gap-1.5 mt-1">
                      <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {{ 'takeover.matched.' + option.matchedBy | translate }}
                      </span>
                      @if (option.inCollection.length > 0) {
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                          {{ 'takeover.inCollection' | translate }}
                        </span>
                      }
                    </span>
                    <button type="button" (click)="select(option)" [attr.data-testid]="'takeover-select-' + option.discogsId"
                      class="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                      {{ 'takeover.select' | translate }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        }

        <div class="flex flex-wrap gap-2">
          <button type="button" (click)="check()" [disabled]="checking()" data-testid="takeover-check" [class]="secondaryButton">
            <svg lucideSearch [size]="14" class="inline -mt-0.5"></svg>
            {{ (checking() ? 'takeover.checking' : 'takeover.check') | translate }}
          </button>
          <a [href]="addReleaseUrl" target="_blank" rel="noopener noreferrer" data-testid="takeover-contribute" [class]="secondaryButton">
            <svg lucideExternalLink [size]="14" class="inline -mt-0.5"></svg>
            {{ 'takeover.contribute' | translate }}
          </a>
          <button type="button" (click)="copyData()" data-testid="takeover-copy" [class]="secondaryButton">
            <svg lucideCopy [size]="14" class="inline -mt-0.5"></svg>
            {{ 'takeover.copyData' | translate }}
          </button>
        </div>
      }
    </div>
  `,
})
export class DiscogsTakeoverComponent {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  /** Detail of the manual record. */
  readonly detail = input.required<RecordDetailDto>();
  readonly takenOver = output<TakeoverResult>();

  readonly addReleaseUrl = DISCOGS_ADD_RELEASE_URL;
  readonly modes: TakeoverMode[] = ['new_copy', 'merge'];
  readonly secondaryButton =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer';

  readonly candidates = signal<DiscogsCandidate[] | null>(null);
  readonly checking = signal(false);
  readonly selected = signal<DiscogsCandidate | null>(null);
  readonly mode = signal<TakeoverMode>('new_copy');
  readonly targetId = signal<number | null>(null);
  readonly running = signal(false);

  private readonly recordId = computed(() => this.detail().discogs_id);

  check(): void {
    if (this.checking()) return;
    this.checking.set(true);
    this.apiService.getDiscogsCandidates(this.recordId()).subscribe({
      next: (candidates) => {
        this.checking.set(false);
        this.candidates.set(candidates);
      },
      error: (err) => {
        this.checking.set(false);
        this.toastService.showToast(getErrorMessage(err, this.languageService.translate('takeover.checkError')), 'error');
      },
    });
  }

  select(candidate: DiscogsCandidate): void {
    this.selected.set(candidate);
    this.mode.set('new_copy');
    this.targetId.set(candidate.inCollection[0] ?? null);
  }

  confirm(): void {
    const candidate = this.selected();
    if (!candidate || this.running()) return;
    const merge = this.mode() === 'merge';
    this.running.set(true);
    this.apiService
      .takeOverManualRecord(this.recordId(), {
        releaseId: candidate.discogsId,
        mode: this.mode(),
        targetInstanceId: merge ? this.targetId() : null,
      })
      .subscribe({
        next: (result) => {
          this.running.set(false);
          this.toastService.showToast(
            this.languageService.translate(merge ? 'takeover.merged' : 'takeover.success'),
            'success'
          );
          this.takenOver.emit(result);
        },
        error: (err) => {
          this.running.set(false);
          this.toastService.showToast(getErrorMessage(err, this.languageService.translate('takeover.error')), 'error');
        },
      });
  }

  async copyData(): Promise<void> {
    try {
      await navigator.clipboard.writeText(contributionText(this.detail()));
      this.toastService.showToast(this.languageService.translate('takeover.copied'), 'success');
    } catch {
      this.toastService.showToast(this.languageService.translate('takeover.copyError'), 'error');
    }
  }

  releaseName(candidate: DiscogsCandidate): string {
    return candidate.artist ? `${candidate.artist} – ${candidate.title}` : candidate.title;
  }

  details(candidate: DiscogsCandidate): string {
    return [candidate.label, candidate.catno, candidate.format, candidate.country, candidate.year].filter(Boolean).join(' · ');
  }

  modeLabel(mode: TakeoverMode): string {
    return mode === 'merge' ? 'takeover.modeMerge' : 'takeover.modeNewCopy';
  }

  modeHint(mode: TakeoverMode): string {
    return mode === 'merge' ? 'takeover.modeMergeHint' : 'takeover.modeNewCopyHint';
  }
}
