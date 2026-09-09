import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { BarcodeScannerComponent } from '../../shared/components/barcode-scanner/barcode-scanner.component';
import { RecentListensComponent } from './components/recent-listens/recent-listens.component';
import { TopRecordsComponent } from './components/top-records/top-records.component';
import { StatisticWidgetComponent } from '../../shared/components/statistic-widget/statistic-widget.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { ScannerService } from '../../core/services/scanner.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { ListenEvent, AnalyticsTopRecord, CollectionValueResponse, GenreBreakdownItem } from '../../core/types';
import { Subscription, firstValueFrom, forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LayoutComponent,
    BarcodeScannerComponent,
    RecentListensComponent,
    TopRecordsComponent,
    StatisticWidgetComponent,
    TranslatePipe,
  ],
  template: `
    <app-layout>
      @if (scannerService.showScanner()) {
        <div
          class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 sm:p-8 animate-fade-in h-full transition-colors"
        >
          <button
            (click)="scannerService.closeScanner()"
            class="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            &larr; {{ 'nav.home' | translate }}
          </button>
          <div class="max-w-md mx-auto">
            <app-barcode-scanner />
          </div>
        </div>
      } @else {
        <div class="flex flex-col lg:grid lg:grid-cols-3 gap-6">
          <!-- Left/Center content: Top Records & Recent Listens -->
          <div class="lg:col-span-2 flex flex-col space-y-6">
            <app-top-records [data]="topRecords()" class="min-h-0">
              <!-- Date Filter Controls projected here -->
              <div
                class="flex gap-2 items-center bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-600 w-full md:w-auto max-w-full overflow-x-auto transition-colors"
              >
                <button
                  (click)="setFilterAll()"
                  [class]="
                    'text-xs px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ' +
                    (!startDate() && !endDate()
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50')
                  "
                >
                  All
                </button>
                <button
                  (click)="setFilterToday()"
                  [class]="
                    'text-xs px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ' +
                    (startDate() === todayString && endDate() === todayString
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50')
                  "
                >
                  Today
                </button>
                <div class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <input
                  type="date"
                  [ngModel]="startDate()"
                  (ngModelChange)="onStartDateChange($event)"
                  class="bg-transparent border-slate-200 dark:border-slate-700 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none font-medium"
                  title="Start Date"
                />
                <span class="text-slate-400 dark:text-slate-500 font-medium">-</span>
                <input
                  type="date"
                  [ngModel]="endDate()"
                  (ngModelChange)="onEndDateChange($event)"
                  class="bg-transparent border-slate-200 dark:border-slate-700 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 outline-none font-medium"
                  title="End Date"
                />
              </div>
            </app-top-records>

            <app-recent-listens
              [listens]="recentListens()"
              (delete)="handleDelete($event)"
              class="min-h-0"
            />
          </div>

          <!-- Right side panel: Collection Value & Genre Breakdown -->
          <div class="lg:col-span-1 flex flex-col space-y-6">
            <!-- Collection Value widget -->
            <app-statistic-widget
              [title]="'dashboard.collectionValue' | translate"
              subtitle="(Discogs)"
              [loading]="loadingStats()"
            >
              <div class="py-2">
                @if (collectionValue(); as val) {
                  <div class="text-2xl font-black text-slate-900 dark:text-slate-100">
                    @if (val.median) {
                      {{ val.median.currency === 'EUR' ? '€' : '$' }}
                      {{ val.median.value | number: '1.2-2' }}
                    } @else {
                      N/A
                    }
                  </div>
                  @if (val.minimum && val.maximum) {
                    <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">
                      Min: {{ val.minimum.value | number: '1.0-0' }} / Max:
                      {{ val.maximum.value | number: '1.0-0' }}
                    </div>
                  }
                } @else {
                  <div class="text-2xl font-black text-slate-900 dark:text-slate-100">N/A</div>
                }
              </div>
            </app-statistic-widget>

            <!-- Genre Breakdown widget -->
            <app-statistic-widget
              [title]="'dashboard.genreBreakdown' | translate"
              [loading]="loadingStats()"
            >
              <div class="flex items-center gap-6 py-2">
                <!-- Conic Gradient Pie Chart -->
                <div
                  class="w-20 h-20 rounded-full shadow-inner relative flex items-center justify-center shrink-0"
                  [style.background]="getConicGradient()"
                >
                  <div
                    class="absolute w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center shadow"
                  >
                    <span class="text-xs font-black text-slate-900 dark:text-slate-100">
                      {{ totalGenreRecords() }}
                    </span>
                  </div>
                </div>

                <!-- Legend -->
                <div class="flex-1 flex flex-col gap-1 min-w-0">
                  @for (entry of genreData().slice(0, 4); track entry.name; let idx = $index) {
                    <div class="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span
                          class="w-2 h-2 rounded-full shrink-0"
                          [style.backgroundColor]="GENRE_COLORS[idx % GENRE_COLORS.length]"
                        ></span>
                        <span class="truncate">{{ entry.name }}</span>
                      </div>
                      <span class="font-bold ml-2">{{ entry.value }}</span>
                    </div>
                  }
                </div>
              </div>
            </app-statistic-widget>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly scannerService = inject(ScannerService);

  readonly recentListens = signal<ListenEvent[]>([]);
  readonly topRecords = signal<AnalyticsTopRecord[]>([]);
  readonly collectionValue = signal<CollectionValueResponse | null>(null);
  readonly genreData = signal<GenreBreakdownItem[]>([]);
  readonly loadingStats = signal<boolean>(true);

  readonly todayString = this.getTodayString();
  readonly startDate = signal<string>(this.todayString);
  readonly endDate = signal<string>(this.todayString);

  readonly GENRE_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'];

  readonly totalGenreRecords = computed(() => {
    return this.genreData().reduce((acc, curr) => acc + curr.value, 0);
  });

  private sub: Subscription | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  loadData(): void {
    const user = this.authService.user();
    if (!user) return;

    if (this.sub) {
      this.sub.unsubscribe();
    }

    this.loadingStats.set(true);

    this.sub = forkJoin({
      recents: this.apiService.getRecentListens(this.startDate(), this.endDate()),
      tops: this.apiService.getTopRecords(this.startDate(), this.endDate()),
      value: this.apiService.getCollectionValue(),
      genres: this.apiService.getGenreBreakdown(),
    }).subscribe({
      next: ({ recents, tops, value, genres }) => {
        this.recentListens.set(recents);
        this.topRecords.set(tops);
        this.collectionValue.set(value);
        this.genreData.set(genres);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard data', err);
        this.toastService.showToast('Failed to load dashboard data', 'error');
        this.loadingStats.set(false);
      },
    });
  }

  onStartDateChange(val: string): void {
    this.startDate.set(val);
    this.loadData();
  }

  onEndDateChange(val: string): void {
    this.endDate.set(val);
    this.loadData();
  }

  setFilterAll(): void {
    this.startDate.set('');
    this.endDate.set('');
    this.loadData();
  }

  setFilterToday(): void {
    this.startDate.set(this.todayString);
    this.endDate.set(this.todayString);
    this.loadData();
  }

  async handleDelete(id: number): Promise<void> {
    const user = this.authService.user();
    if (!user || !window.confirm('Delete this scan?')) return;

    try {
      await firstValueFrom(this.apiService.deleteScan(id));
      this.recentListens.update((prev) => prev.filter((item) => item.id !== id));

      // Refresh top records
      const tops = await firstValueFrom(
        this.apiService.getTopRecords(this.startDate(), this.endDate())
      );
      this.topRecords.set(tops);

      this.toastService.showToast('Scan deleted successfully', 'success');
    } catch (err) {
      console.error(err);
      this.toastService.showToast('Failed to delete scan', 'error');
    }
  }

  getConicGradient(): string {
    const data = this.genreData();
    if (!data.length) return '#cbd5e1';

    const total = this.totalGenreRecords();
    if (total === 0) return '#cbd5e1';

    let currentPercentage = 0;
    const segments = data.map((entry, idx) => {
      const start = currentPercentage;
      const percentage = (entry.value / total) * 100;
      currentPercentage += percentage;
      const color = this.GENRE_COLORS[idx % this.GENRE_COLORS.length];
      return `${color} ${start}% ${currentPercentage}%`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }

  private getTodayString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
