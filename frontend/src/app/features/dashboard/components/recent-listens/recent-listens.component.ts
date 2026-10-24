import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';
import { ListenEvent, TrackedRecord } from '../../../../core/types';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { LucideTrash2 } from '@lucide/angular';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-recent-listens',
  standalone: true,
  imports: [LocalizedDatePipe, TranslatePipe, LucideTrash2, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      [class]="
        'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 dark:hover:border-slate-600/50 ' +
        className()
      "
    >
      <div
        class="p-4 pb-3 md:p-6 md:pb-4 border-b border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-800 z-10 transition-colors"
      >
        <h2 class="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {{ 'dashboard.recentListens' | translate }}
        </h2>
      </div>

      <!-- Scrollable Container -->
      <div class="flex-1 overflow-y-auto p-2 md:p-6 md:pt-4">
        <!-- Mobile: compact list (like "Meistgespielte Alben"); md+: tile grid -->
        <div
          class="flex flex-col gap-1 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-8"
          data-testid="recent-listens-list"
        >
          @for (event of listens(); track event.id; let idx = $index) {
            <div
              class="relative flex flex-row items-center gap-3 rounded-xl p-2 group transition-all duration-300 animate-slide-up hover:bg-slate-50 dark:hover:bg-slate-700/40 md:flex-col md:items-stretch md:gap-3 md:rounded-2xl md:p-4 md:border md:border-slate-200 md:dark:border-slate-600 md:bg-white md:dark:bg-slate-800 md:hover:bg-white md:dark:hover:bg-slate-800 md:hover:shadow-xl md:hover:-translate-y-1"
              [style.animationDelay]="(idx % 6) * 75 + 'ms'"
              style="opacity: 0"
            >

              <!-- The whole entry opens the record's details; the delete button sits above it -->
              <button
                type="button"
                (click)="openRecord.emit(event.record)"
                class="absolute inset-0 z-10 rounded-xl md:rounded-2xl cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500"
                [attr.aria-label]="'Details: ' + event.record.title"
                data-testid="recent-open"
              ></button>

              <!-- Cover Image -->
              <div
                class="w-10 h-10 shrink-0 rounded-lg md:w-full md:h-auto md:aspect-square md:rounded-xl bg-slate-100 dark:bg-slate-700/50 overflow-hidden relative shadow-inner"
                data-testid="recent-cover"
              >
                <img
                  [src]="
                    event.record.thumbUrl
                      ? apiService.getProxiedImageUrl(event.record.thumbUrl)
                      : '/placeholder.png'
                  "
                  [alt]="event.record.title"
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              <!-- Info & Actions -->
              <div class="flex-1 min-w-0 flex flex-row items-center gap-2 md:flex-col md:items-stretch md:gap-0 md:pt-1">
                <div class="flex-1 min-w-0 flex justify-between items-start gap-2 w-full">
                  <div class="flex-1 min-w-0">
                    <h3
                      class="font-bold text-slate-900 dark:text-slate-100 truncate text-sm md:text-base leading-tight md:mb-1"
                      [title]="event.record.title"
                    >
                      {{ event.record.title }}
                    </h3>
                    <p class="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                      {{ event.record.artist }}
                      <span class="md:hidden"> · {{ event.timestamp | localizedDate: 'short' }}</span>
                    </p>
                  </div>
                  <!-- Always visible on touch screens; revealed on hover from md -->
                  <button
                    type="button"
                    (click)="delete.emit(event.id)"
                    class="relative z-20 w-11 h-11 -my-2 -mr-1 flex items-center justify-center md:w-auto md:h-auto md:p-1.5 md:-mr-1.5 md:-mt-1 md:my-0 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                    [appTooltip]="'dashboard.deleteListen' | translate"
                    data-testid="delete-listen"
                    [attr.aria-label]="'Delete Scan: ' + event.record.title"
                  >
                    <svg lucideTrash2 [size]="16"></svg>
                  </button>
                </div>

                <div
                  class="hidden md:flex mt-4 pt-3 border-t border-slate-100 dark:border-slate-600 justify-between items-center w-full z-20"
                >
                  <span class="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {{ event.timestamp | localizedDate: 'medium' }}
                  </span>
                </div>
              </div>
            </div>
          }
        </div>

        @if (listens().length === 0) {
          <div
            class="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800/30 animate-fade-in"
          >
            <div
              class="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 shadow-inner"
            >
              <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">
              {{ 'dashboard.noListens' | translate }}
            </h3>
          </div>
        }
      </div>
    </div>
  `,
})
export class RecentListensComponent {
  readonly apiService = inject(ApiService);

  readonly listens = input.required<ListenEvent[]>();
  readonly className = input<string>('');
  readonly delete = output<number>();
  readonly openRecord = output<TrackedRecord>();
}

