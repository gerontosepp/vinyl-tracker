import { Component, input, output, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AnalyticsTopArtist, AnalyticsTopRecord } from '../../../../core/types';
import { NgTemplateOutlet } from '@angular/common';
import { ArtistCollageComponent } from '../artist-collage/artist-collage.component';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LucideChevronDown, LucideChevronUp } from '@lucide/angular';

@Component({
  selector: 'app-top-records',
  standalone: true,
  imports: [TranslatePipe, LucideChevronDown, LucideChevronUp, NgTemplateOutlet, ArtistCollageComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <!-- Rank badge with medals for places 1-3 -->
    <ng-template #rankBadge let-idx>
      @if (idx === 0) {
        <span
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 shadow-xs border border-amber-300/70 dark:border-amber-700/60"
          title="1"
        >1</span>
      } @else if (idx === 1) {
        <span
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 shadow-xs border border-slate-300 dark:border-slate-600"
          title="2"
        >2</span>
      } @else if (idx === 2) {
        <span
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black bg-amber-900/15 text-amber-900 dark:bg-amber-950/60 dark:text-amber-400 shadow-xs border border-amber-800/30 dark:border-amber-800/50"
          title="3"
        >3</span>
      } @else {
        <span class="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">
          {{ idx + 1 }}
        </span>
      }
    </ng-template>
    <div
      [class]="
        'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 ' +
        className()
      "
    >
      <div
        class="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-800 z-10 transition-colors"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <span class="text-base sm:text-lg">🏆</span>
            <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {{ 'stats.mostPlayed' | translate }}
            </h2>
            <div class="inline-flex p-0.5 bg-slate-100 dark:bg-slate-900/60 rounded-lg text-xs font-bold" role="tablist">
              @for (option of tabs; track option) {
                <button
                  type="button"
                  role="tab"
                  (click)="selectTab(option)"
                  [attr.aria-selected]="tab() === option"
                  [attr.data-testid]="'top-tab-' + option"
                  class="px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  [class]="tab() === option ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 dark:text-slate-400'"
                >
                  {{ (option === 'records' ? 'stats.tabAlbums' : 'stats.tabArtists') | translate }}
                </button>
              }
            </div>
          </div>
          <div class="w-full sm:w-auto">
            <ng-content></ng-content>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        @if (tab() === 'records') {
        @for (record of visibleData(); track record.title + record.artist || $index; let idx = $index) {
          <div
            class="group relative flex items-center gap-3 p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-100/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all duration-200 overflow-hidden shadow-xs hover:shadow-sm"
          >
            <!-- The whole row opens the record's details -->
            @if (record.discogsId) {
              <button
                type="button"
                (click)="openRecord.emit(record)"
                class="absolute inset-0 z-20 rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
                [attr.aria-label]="'Details: ' + (record.title || record.recordTitle)"
                data-testid="top-record-open"
              ></button>
            }

            <!-- Background Relative Progress Bar -->
            <div
              class="absolute inset-y-0 left-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl transition-all duration-700 ease-out pointer-events-none"
              [style.width]="(record.count / maxCount() * 100) + '%'"
            ></div>

            <div class="shrink-0 z-10">
              <ng-container [ngTemplateOutlet]="rankBadge" [ngTemplateOutletContext]="{ $implicit: idx }" />
            </div>

            <!-- Cover Thumbnail (38x38px) -->
            <div
              class="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative shadow-xs border border-slate-200/60 dark:border-slate-700 z-10"
            >
              @if (record.thumbUrl) {
                <img
                  [src]="apiService.getProxiedImageUrl(record.thumbUrl)"
                  [alt]="record.title"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              } @else {
                <div
                  class="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-[10px] font-semibold"
                >
                  🎵
                </div>
              }
            </div>

            <!-- Title & Artist -->
            <div class="flex-1 min-w-0 z-10">
              <h3
                class="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-tight truncate"
                [title]="record.title || record.recordTitle"
              >
                {{ record.title || record.recordTitle }}
              </h3>
              @if (record.artist) {
                <p
                  class="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5"
                >
                  {{ record.artist }}
                </p>
              }
            </div>

            <!-- Play Count Pill -->
            <div class="shrink-0 z-10 pl-2">
              <span
                class="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs"
              >
                <span>{{ record.count }}</span>
                <span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">plays</span>
              </span>
            </div>
          </div>
        }

        } @else {
          @for (artist of visibleArtists(); track artist.artist; let idx = $index) {
            <div
              class="group relative flex items-center gap-3 p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-100/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all duration-200 overflow-hidden shadow-xs hover:shadow-sm"
            >
              <!-- The whole row opens the collection filtered to the artist -->
              <button
                type="button"
                (click)="openArtist.emit(artist)"
                class="absolute inset-0 z-20 rounded-xl cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
                [attr.aria-label]="artist.artist"
                data-testid="top-artist-open"
              ></button>
              <div
                class="absolute inset-y-0 left-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl transition-all duration-700 ease-out pointer-events-none"
                [style.width]="(artist.count / maxCount() * 100) + '%'"
              ></div>
              <div class="shrink-0 z-10">
                <ng-container [ngTemplateOutlet]="rankBadge" [ngTemplateOutletContext]="{ $implicit: idx }" />
              </div>
              <app-artist-collage [thumbUrls]="artist.thumbUrls" [alt]="artist.artist" class="z-10" />
              <div class="flex-1 min-w-0 z-10">
                <h3 class="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-tight truncate" [title]="artist.artist">
                  {{ artist.artist }}
                </h3>
                <p class="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {{ 'stats.albumCount' | translate: { count: artist.recordCount } }}
                </p>
              </div>
              <div class="shrink-0 z-10 pl-2">
                <span
                  class="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/50 shadow-2xs"
                >
                  <span>{{ artist.count }}</span>
                  <span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">plays</span>
                </span>
              </div>
            </div>
          }
        }

        <!-- Show More / Less Toggle if more than 5 entries -->
        @if (activeCount() > 5) {
          <div class="pt-1 flex justify-center">
            <button
              type="button"
              (click)="toggleShowAll()"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 py-1.5 px-3 rounded-lg transition-all duration-200 cursor-pointer shadow-2xs border border-slate-200/60 dark:border-slate-700"
            >
              <span>{{ (showAll() ? 'stats.showLess' : 'stats.showMore') | translate }}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {{ showAll() ? 5 : activeCount() }}
              </span>
              @if (showAll()) {
                <svg lucideChevronUp [size]="14"></svg>
              } @else {
                <svg lucideChevronDown [size]="14"></svg>
              }
            </button>
          </div>
        }

        @if (activeCount() === 0) {
          <div
            class="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 animate-fade-in"
          >
            <div
              class="w-12 h-12 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500 shadow-inner"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300">
              {{ 'collection.noRecords' | translate }}
            </h3>
          </div>
        }
      </div>
    </div>
  `,
})
export class TopRecordsComponent {
  readonly apiService = inject(ApiService);

  readonly data = input.required<AnalyticsTopRecord[]>();
  readonly artists = input<AnalyticsTopArtist[]>([]);
  readonly className = input<string>('');
  readonly openRecord = output<AnalyticsTopRecord>();
  readonly openArtist = output<AnalyticsTopArtist>();

  readonly tabs = ['records', 'artists'] as const;
  readonly tab = signal<'records' | 'artists'>('records');
  readonly showAll = signal<boolean>(false);

  /** Entries of the active tab. */
  private readonly active = computed(() => (this.tab() === 'records' ? this.data() : this.artists()));
  readonly activeCount = computed(() => this.active().length);

  readonly maxCount = computed(() => {
    const counts = this.active().map((r) => r.count);
    return counts.length > 0 ? Math.max(...counts, 0) : 0;
  });

  readonly visibleData = computed(() => {
    const all = this.data();
    return this.showAll() ? all : all.slice(0, 5);
  });

  readonly visibleArtists = computed(() => {
    const all = this.artists();
    return this.showAll() ? all : all.slice(0, 5);
  });

  selectTab(tab: 'records' | 'artists'): void {
    this.tab.set(tab);
    this.showAll.set(false);
  }

  toggleShowAll(): void {
    this.showAll.update((v) => !v);
  }
}
