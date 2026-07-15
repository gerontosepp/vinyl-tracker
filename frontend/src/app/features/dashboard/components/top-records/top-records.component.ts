import { Component, input, inject, computed } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { AnalyticsTopRecord } from '../../../../core/types';

@Component({
  selector: 'app-top-records',
  standalone: true,
  template: `
    <div
      [class]="
        'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 ' +
        className()
      "
    >
      <div
        class="p-6 pb-4 border-b border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-800 z-10 transition-colors"
      >
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Top Records
          </h2>
          <div class="w-full lg:w-auto">
            <ng-content></ng-content>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
        @for (record of data(); track $index; let idx = $index) {
          <div
            class="group transition-all duration-300 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 -mx-4 p-4 rounded-xl animate-slide-up"
            [style.animationDelay]="(idx % 5) * 100 + 'ms'"
            style="opacity: 0"
          >
            <div class="flex gap-4 mb-2">
              <!-- Cover Image -->
              <div
                class="w-14 h-14 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative shadow-sm"
              >
                @if (record.thumbUrl) {
                  <img
                    [src]="apiService.getProxiedImageUrl(record.thumbUrl)"
                    [alt]="record.title"
                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                } @else {
                  <div
                    class="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium"
                  >
                    No Cover
                  </div>
                }
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <div class="truncate pr-4">
                    <h3
                      class="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate"
                      [title]="record.title || record.recordTitle"
                    >
                      {{ record.title || record.recordTitle }}
                    </h3>
                    @if (record.artist) {
                      <p
                        class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5"
                      >
                        {{ record.artist }}
                      </p>
                    }
                  </div>
                  <span
                    class="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full"
                  >
                    {{ record.count }} plays
                  </span>
                </div>

                <!-- Progress Bar -->
                <div
                  class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden mt-3 shadow-inner"
                >
                  <div
                    class="bg-indigo-500 hover:bg-indigo-400 h-full rounded-full transition-all duration-1000 ease-out"
                    [style.width]="record.count / maxCount() * 100 + '%'"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        }
        @if (data().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 animate-fade-in"
          >
            <div
              class="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 shadow-inner"
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
              No Top Records
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 max-w-[250px]">
              Start listening to some music and your most played records will appear here over time.
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class TopRecordsComponent {
  readonly apiService = inject(ApiService);

  readonly data = input.required<AnalyticsTopRecord[]>();
  readonly className = input<string>('');

  readonly maxCount = computed(() => {
    const counts = this.data().map((r) => r.count);
    return counts.length > 0 ? Math.max(...counts, 0) : 0;
  });
}
