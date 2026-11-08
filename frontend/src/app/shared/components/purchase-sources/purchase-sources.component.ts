import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LucideChevronDown, LucideExternalLink } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { MarketplaceStats, PurchaseSources, VinylVersion } from '../../../core/types';

/** Versions shown before "show all". */
export const VISIBLE_VERSIONS = 10;

type LoadError = 'rateLimited' | 'failed';

/**
 * Online sources of a Want-to-Have record (#319): all Vinyl versions with Discogs marketplace
 * figures and search links to shops. Nothing is requested before the section is opened.
 */
@Component({
  selector: 'app-purchase-sources',
  standalone: true,
  imports: [TranslatePipe, LucideChevronDown, LucideExternalLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2" data-testid="purchase-sources">
      <button
        type="button"
        class="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        [attr.aria-expanded]="open()"
        data-testid="sources-toggle"
        (click)="toggle()"
      >
        <span>{{ 'wantToHave.sources.title' | translate }}</span>
        <svg lucideChevronDown [size]="16" class="transition-transform" [class.rotate-180]="open()"></svg>
      </button>

      @if (open()) {
        @if (loading()) {
          <p class="text-xs text-slate-500 dark:text-slate-400" data-testid="sources-loading">
            {{ 'wantToHave.sources.loading' | translate }}
          </p>
        } @else if (error(); as err) {
          <div class="space-y-2" data-testid="sources-error">
            <p class="text-xs text-red-600 dark:text-red-400">
              {{ (err === 'rateLimited' ? 'wantToHave.sources.rateLimited' : 'wantToHave.sources.failed') | translate }}
            </p>
            <button
              type="button"
              class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              data-testid="sources-retry"
              (click)="load()"
            >
              {{ 'wantToHave.sources.retry' | translate }}
            </button>
          </div>
        } @else if (sources(); as data) {
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'wantToHave.sources.hint' | translate }}</p>

          <div class="space-y-1">
            <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {{ 'wantToHave.sources.shops' | translate }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              @for (link of data.shop_links; track link.shop) {
                <a
                  [href]="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  [attr.data-testid]="'shop-link-' + link.shop"
                >
                  {{ link.name }}
                  <svg lucideExternalLink [size]="12" aria-hidden="true"></svg>
                </a>
              }
            </div>
          </div>

          <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {{ 'wantToHave.sources.versions' | translate: { count: data.total_versions } }}
          </p>
          <ul
            class="divide-y divide-slate-100 dark:divide-slate-700/50 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden"
          >
            @for (version of visibleVersions(); track version.release_id) {
              <li
                class="px-3 py-2 text-xs space-y-1"
                [class.ring-2]="version.is_wanted"
                [class.ring-inset]="version.is_wanted"
                [class.ring-indigo-400]="version.is_wanted"
                [attr.data-testid]="'version-' + version.release_id"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    @if (version.is_wanted) {
                      <span
                        class="inline-block mb-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300"
                        data-testid="wanted-badge"
                      >
                        {{ 'wantToHave.sources.wanted' | translate }}
                      </span>
                    }
                    <p class="font-medium text-slate-700 dark:text-slate-200 truncate">{{ details(version) }}</p>
                  </div>
                  <a
                    [href]="version.marketplace_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="shrink-0 text-indigo-600 dark:text-indigo-400"
                    [attr.aria-label]="'wantToHave.sources.openMarketplace' | translate"
                  >
                    <svg lucideExternalLink [size]="14" aria-hidden="true"></svg>
                  </a>
                </div>

                @if (version.stats; as stats) {
                  <p class="text-slate-600 dark:text-slate-300" [attr.data-testid]="'stats-' + version.release_id">
                    @if (stats.blocked_from_sale) {
                      {{ 'wantToHave.sources.blocked' | translate }}
                    } @else if (stats.lowest_price !== null && stats.num_for_sale > 0) {
                      <span class="font-semibold">{{
                        'wantToHave.sources.from' | translate: { price: price(stats.lowest_price, stats.currency) }
                      }}</span>
                      · {{ 'wantToHave.sources.offers' | translate: { count: stats.num_for_sale } }}
                    } @else {
                      {{ 'wantToHave.sources.noOffers' | translate }}
                    }
                  </p>
                } @else {
                  <button
                    type="button"
                    class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline disabled:opacity-50"
                    [disabled]="statsLoading().has(version.release_id)"
                    [attr.data-testid]="'load-price-' + version.release_id"
                    (click)="loadStats(version)"
                  >
                    {{ 'wantToHave.sources.loadPrice' | translate }}
                  </button>
                }
              </li>
            }
          </ul>

          @if (data.versions.length > visibleLimit) {
            <button
              type="button"
              class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              data-testid="sources-show-all"
              (click)="showAll.set(!showAll())"
            >
              {{
                (showAll() ? 'wantToHave.sources.showLess' : 'wantToHave.sources.showAll')
                  | translate: { count: data.versions.length }
              }}
            </button>
          }
          @if (data.truncated) {
            <p class="text-[11px] text-slate-400" data-testid="sources-truncated">
              {{ 'wantToHave.sources.truncated' | translate: { count: data.total_versions } }}
            </p>
          }
        }
      }
    </div>
  `,
})
export class PurchaseSourcesComponent {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);
  private readonly toast = inject(ToastService);

  /** ID of the Want-to-Have list entry. */
  readonly wantToHaveId = input.required<number>();

  readonly visibleLimit = VISIBLE_VERSIONS;

  // Everything below starts over when another entry is shown
  readonly open = linkedSignal<number, boolean>({ source: this.wantToHaveId, computation: () => false });
  readonly sources = linkedSignal<number, PurchaseSources | null>({ source: this.wantToHaveId, computation: () => null });
  readonly loading = linkedSignal<number, boolean>({ source: this.wantToHaveId, computation: () => false });
  readonly error = linkedSignal<number, LoadError | null>({ source: this.wantToHaveId, computation: () => null });
  readonly showAll = linkedSignal<number, boolean>({ source: this.wantToHaveId, computation: () => false });
  readonly statsLoading = linkedSignal<number, ReadonlySet<number>>({
    source: this.wantToHaveId,
    computation: () => new Set<number>(),
  });

  readonly visibleVersions = computed(() => {
    const versions = this.sources()?.versions ?? [];
    return this.showAll() ? versions : versions.slice(0, VISIBLE_VERSIONS);
  });

  toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    if (opening && !this.sources() && !this.loading()) void this.load();
  }

  async load(): Promise<void> {
    const id = this.wantToHaveId();
    this.loading.set(true);
    this.error.set(null);
    try {
      const sources = await firstValueFrom(this.api.getWantToHaveSources(id));
      // Ignore a late answer for an entry that is no longer shown
      if (this.wantToHaveId() === id) this.sources.set(sources);
    } catch (e) {
      if (this.wantToHaveId() === id) {
        const error: LoadError = e instanceof HttpErrorResponse && e.status === 429 ? 'rateLimited' : 'failed';
        this.error.set(error);
        // Also as a toast: the section can be scrolled out of sight
        this.toast.showToast(this.language.translate(`wantToHave.sources.${error}`), 'error');
      }
    } finally {
      if (this.wantToHaveId() === id) this.loading.set(false);
    }
  }

  async loadStats(version: VinylVersion): Promise<void> {
    const id = this.wantToHaveId();
    if (this.statsLoading().has(version.release_id)) return;
    this.statsLoading.update((set) => new Set(set).add(version.release_id));
    try {
      const stats = await firstValueFrom(this.api.getWantToHaveVersionStats(id, version.release_id));
      if (this.wantToHaveId() === id) this.applyStats(stats);
    } catch (e) {
      if (this.wantToHaveId() === id) {
        const key = e instanceof HttpErrorResponse && e.status === 429 ? 'wantToHave.sources.rateLimited' : 'wantToHave.sources.priceError';
        this.toast.showToast(this.language.translate(key), 'error');
      }
    } finally {
      if (this.wantToHaveId() === id) {
        this.statsLoading.update((set) => {
          const next = new Set(set);
          next.delete(version.release_id);
          return next;
        });
      }
    }
  }

  /** "Label · CAT 1 · UK · 1974 · LP" – whatever Discogs knows about the pressing. */
  details(version: VinylVersion): string {
    const parts = [version.label, version.catno, version.country, version.released?.slice(0, 4), version.format].filter(Boolean);
    return parts.length ? parts.join(' · ') : version.title;
  }

  price(value: number, currency: string | null): string {
    const locale = this.language.locale();
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? this.sources()?.currency ?? 'EUR' }).format(value);
  }

  private applyStats(stats: MarketplaceStats): void {
    this.sources.update((current) =>
      current
        ? { ...current, versions: current.versions.map((v) => (v.release_id === stats.release_id ? { ...v, stats } : v)) }
        : current
    );
  }
}
