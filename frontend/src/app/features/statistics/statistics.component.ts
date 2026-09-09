import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { StatisticWidgetComponent } from '../../shared/components/statistic-widget/statistic-widget.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { CollectionValueResponse, GenreBreakdownItem } from '../../core/types';
import { getErrorMessage } from '../../core/utils/error';
import { Subscription, firstValueFrom } from 'rxjs';

type CollectionValueTrendPoint = {
  timestamp: string;
  label: string;
  minimum: number;
  median: number;
  maximum: number;
  currency: string;
};

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule, LayoutComponent, StatisticWidgetComponent, TranslatePipe],
  template: `
    <app-layout>
      <div class="flex flex-col space-y-6 md:h-[calc(100vh-5rem)]">
        <div
          class="flex-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0"
        >
          <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {{ 'stats.title' | translate }}
            </h1>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
              {{ 'stats.overview' | translate }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
          <!-- Widget 1: Collection Value -->
          <app-statistic-widget
            [title]="'dashboard.collectionValue' | translate"
            subtitle="(Discogs)"
            class="lg:col-span-2"
            [loading]="isCollectionValueLoading()"
            [error]="collectionValueError()"
          >
            <div class="flex justify-between items-start mb-6">
              <div>
                @if (collectionValue(); as val) {
                  <div
                    class="text-3xl font-black text-slate-900 dark:text-slate-100 flex items-baseline gap-3"
                  >
                    @if (val.median) {
                      {{ val.median.currency === 'EUR' ? '€' : '$' }}
                      {{ val.median.value | number: '1.2-2' }}
                    } @else {
                      N/A
                    }

                    @if (val.minimum && val.maximum) {
                      <span class="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Min: {{ val.minimum.value | number: '1.0-0' }} / Max:
                        {{ val.maximum.value | number: '1.0-0' }}
                      </span>
                    }
                  </div>
                } @else {
                  <div class="text-3xl font-black text-slate-900 dark:text-slate-100">N/A</div>
                }
              </div>
            </div>

            <div
              class="flex flex-wrap items-center gap-3 mb-3 text-xs font-semibold text-slate-500 dark:text-slate-300"
            >
              <div class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                Minimum
              </div>
              <div class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                Median
              </div>
              <div class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Maximum
              </div>
            </div>

            <!-- Custom SVG Trend Chart -->
            <div class="h-48 w-full relative">
              @if (collectionValueHistory().length > 1) {
                <svg class="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                  <!-- Gradients -->
                  <defs>
                    <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity="0.35" />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="colorMinimum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity="0.2" />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="colorMaximum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity="0.2" />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <!-- Cartesian Grid lines -->
                  <line
                    x1="0"
                    y1="50"
                    x2="500"
                    y2="50"
                    stroke="#334155"
                    stroke-dasharray="3 3"
                    opacity="0.1"
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="500"
                    y2="100"
                    stroke="#334155"
                    stroke-dasharray="3 3"
                    opacity="0.1"
                  />
                  <line
                    x1="0"
                    y1="150"
                    x2="500"
                    y2="150"
                    stroke="#334155"
                    stroke-dasharray="3 3"
                    opacity="0.1"
                  />

                  <!-- Maximum Area -->
                  <polygon
                    [attr.points]="
                      getFillPoints(collectionValueHistory(), 'maximum', 500, 200, historyMax())
                    "
                    fill="url(#colorMaximum)"
                  />
                  <polyline
                    [attr.points]="
                      getAreaPoints(collectionValueHistory(), 'maximum', 500, 200, historyMax())
                    "
                    fill="none"
                    stroke="#f59e0b"
                    stroke-width="2"
                  />

                  <!-- Minimum Area -->
                  <polygon
                    [attr.points]="
                      getFillPoints(collectionValueHistory(), 'minimum', 500, 200, historyMax())
                    "
                    fill="url(#colorMinimum)"
                  />
                  <polyline
                    [attr.points]="
                      getAreaPoints(collectionValueHistory(), 'minimum', 500, 200, historyMax())
                    "
                    fill="none"
                    stroke="#22c55e"
                    stroke-width="2"
                  />

                  <!-- Median Area -->
                  <polygon
                    [attr.points]="
                      getFillPoints(collectionValueHistory(), 'median', 500, 200, historyMax())
                    "
                    fill="url(#colorMedian)"
                  />
                  <polyline
                    [attr.points]="
                      getAreaPoints(collectionValueHistory(), 'median', 500, 200, historyMax())
                    "
                    fill="none"
                    stroke="#6366f1"
                    stroke-width="3"
                  />
                </svg>
              } @else {
                <div class="flex items-center justify-center h-full text-slate-400">
                  Insufficient history points to show trend.
                </div>
              }
            </div>
          </app-statistic-widget>

          <!-- Widget 2: Genre Breakdown -->
          <app-statistic-widget
            title="Genre Breakdown"
            [loading]="isGenreLoading()"
            [error]="genreError()"
            class="flex flex-col"
          >
            <div class="flex-1 flex items-center justify-center relative min-h-[180px]">
              <!-- Conic Gradient Pie Chart -->
              <div
                class="w-36 h-36 rounded-full shadow-inner relative flex items-center justify-center transition-transform hover:scale-105 duration-300"
                [style.background]="getConicGradient()"
              >
                <div
                  class="absolute w-24 h-24 rounded-full bg-white dark:bg-slate-800 flex flex-col items-center justify-center shadow"
                >
                  <span class="text-xl font-black text-slate-900 dark:text-slate-100">
                    {{ totalGenreRecords() }}
                  </span>
                  <span class="text-[10px] font-bold text-slate-500 uppercase">Records</span>
                </div>
              </div>
            </div>

            <!-- Legend -->
            <div class="flex flex-wrap gap-2 mt-4 justify-center">
              @for (entry of genreData(); track entry.name; let idx = $index) {
                <div
                  class="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <span
                    class="w-2.5 h-2.5 rounded-full"
                    [style.backgroundColor]="GENRE_COLORS[idx % GENRE_COLORS.length]"
                  ></span>
                  {{ entry.name }} ({{ entry.value }})
                </div>
              }
            </div>
          </app-statistic-widget>

          <!-- Widget 3: Listening Habits -->
          <app-statistic-widget
            title="Listening Habits"
            subtitle="Weekly Listening (hrs)"
            class="lg:col-span-3"
          >
            <!-- Custom SVG Habits Chart -->
            <div class="h-40 w-full relative">
              <svg class="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="colorListening" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <!-- Grid lines -->
                <line
                  x1="0"
                  y1="37.5"
                  x2="500"
                  y2="37.5"
                  stroke="#334155"
                  stroke-dasharray="3 3"
                  opacity="0.1"
                />
                <line
                  x1="0"
                  y1="75"
                  x2="500"
                  y2="75"
                  stroke="#334155"
                  stroke-dasharray="3 3"
                  opacity="0.1"
                />
                <line
                  x1="0"
                  y1="112.5"
                  x2="500"
                  y2="112.5"
                  stroke="#334155"
                  stroke-dasharray="3 3"
                  opacity="0.1"
                />

                <!-- Listening area -->
                <polygon
                  [attr.points]="getFillPoints(MOCK_LISTENING_DATA, 'hrs', 500, 150, habitsMax)"
                  fill="url(#colorListening)"
                />
                <polyline
                  [attr.points]="getAreaPoints(MOCK_LISTENING_DATA, 'hrs', 500, 150, habitsMax)"
                  fill="none"
                  stroke="#f59e0b"
                  stroke-width="2.5"
                />
              </svg>

              <!-- Day Labels overlay -->
              <div class="flex justify-between text-[10px] text-slate-500 font-bold px-2 mt-2">
                @for (d of MOCK_LISTENING_DATA; track d.day) {
                  <span>{{ d.day }} ({{ d.hrs }}h)</span>
                }
              </div>
            </div>
          </app-statistic-widget>
        </div>
      </div>
    </app-layout>
  `,
})
export class StatisticsComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);

  readonly GENRE_COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'];
  private readonly VALUE_HISTORY_STORAGE_PREFIX = 'dashboard_collection_value_history_v1';
  private readonly MAX_VALUE_HISTORY_POINTS = 60;

  readonly MOCK_LISTENING_DATA = [
    { day: 'Mon', hrs: 2 },
    { day: 'Tue', hrs: 4 },
    { day: 'Wed', hrs: 3 },
    { day: 'Thu', hrs: 6 },
    { day: 'Fri', hrs: 5 },
    { day: 'Sat', hrs: 8 },
    { day: 'Sun', hrs: 7 },
  ];

  readonly habitsMax = 9; // Math.max(...mockListens.map(d=>d.hrs)) * 1.1 approx

  readonly collectionValue = signal<CollectionValueResponse | null>(null);
  readonly genreData = signal<GenreBreakdownItem[]>([]);
  readonly isCollectionValueLoading = signal(true);
  readonly isGenreLoading = signal(true);
  readonly collectionValueError = signal('');
  readonly genreError = signal('');
  readonly collectionValueHistory = signal<CollectionValueTrendPoint[]>([]);

  readonly totalGenreRecords = computed(() => {
    return this.genreData().reduce((acc, curr) => acc + curr.value, 0);
  });

  readonly historyMax = computed(() => {
    const hist = this.collectionValueHistory();
    if (!hist.length) return 1;
    return Math.max(...hist.map((h) => h.maximum), 0) * 1.1 || 1;
  });

  private valueSub: Subscription | null = null;
  private genreSub: Subscription | null = null;

  ngOnInit(): void {
    this.loadHistory();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.valueSub) this.valueSub.unsubscribe();
    if (this.genreSub) this.genreSub.unsubscribe();
  }

  private loadHistory(): void {
    const user = this.authService.user();
    if (!user) return;

    try {
      const raw = localStorage.getItem(this.getValueHistoryStorageKey(user.username));
      if (raw) {
        const parsed = JSON.parse(raw) as CollectionValueTrendPoint[];
        if (Array.isArray(parsed)) {
          this.collectionValueHistory.set(
            parsed
              .filter(
                (p) =>
                  typeof p?.timestamp === 'string' &&
                  typeof p?.minimum === 'number' &&
                  typeof p?.median === 'number' &&
                  typeof p?.maximum === 'number'
              )
              .slice(-this.MAX_VALUE_HISTORY_POINTS)
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load history', e);
    }
  }

  private loadData(): void {
    const user = this.authService.user();
    if (!user) return;

    this.isCollectionValueLoading.set(true);
    this.isGenreLoading.set(true);
    this.collectionValueError.set('');
    this.genreError.set('');

    this.valueSub = this.apiService.getCollectionValue().subscribe({
      next: (val) => {
        this.collectionValue.set(val);
        this.appendCollectionValueHistory(val);
        this.isCollectionValueLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        const msg = getErrorMessage(err, 'Collection value currently unavailable.');
        this.collectionValue.set(null);
        this.collectionValueError.set(msg);
        this.toastService.showToast(msg, 'error');
        this.isCollectionValueLoading.set(false);
      },
    });

    this.genreSub = this.apiService.getGenreBreakdown().subscribe({
      next: (genres) => {
        this.genreData.set(genres);
        this.isGenreLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        const msg = getErrorMessage(err, 'Genre breakdown currently unavailable.');
        this.genreData.set([]);
        this.genreError.set(msg);
        this.toastService.showToast(msg, 'error');
        this.isGenreLoading.set(false);
      },
    });
  }

  private appendCollectionValueHistory(value: CollectionValueResponse): void {
    const user = this.authService.user();
    if (!user) return;

    const minValue = value.minimum?.value;
    const medianValue = value.median?.value;
    const maxValue = value.maximum?.value;

    if (
      typeof minValue !== 'number' ||
      typeof medianValue !== 'number' ||
      typeof maxValue !== 'number'
    ) {
      return;
    }

    const now = new Date();
    const nextPoint: CollectionValueTrendPoint = {
      timestamp: now.toISOString(),
      label: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      minimum: minValue,
      median: medianValue,
      maximum: maxValue,
      currency: value.median?.currency || value.minimum?.currency || value.maximum?.currency || '$',
    };

    this.collectionValueHistory.update((prev) => {
      const last = prev[prev.length - 1];
      const isDuplicate =
        last &&
        last.minimum === nextPoint.minimum &&
        last.median === nextPoint.median &&
        last.maximum === nextPoint.maximum;

      const updated = isDuplicate
        ? prev
        : [...prev, nextPoint].slice(-this.MAX_VALUE_HISTORY_POINTS);

      localStorage.setItem(this.getValueHistoryStorageKey(user.username), JSON.stringify(updated));
      return updated;
    });
  }

  private getValueHistoryStorageKey(username: string): string {
    return `${this.VALUE_HISTORY_STORAGE_PREFIX}_${username}`;
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

  getAreaPoints(data: any[], key: string, width: number, height: number, maxVal: number): string {
    if (!data.length) return '';
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      // Invert Y because SVG coordinates start top-left
      const y = height - (d[key] / maxVal) * height;
      return `${x},${y}`;
    });
    return points.join(' ');
  }

  getFillPoints(data: any[], key: string, width: number, height: number, maxVal: number): string {
    if (!data.length) return '';
    const area = this.getAreaPoints(data, key, width, height, maxVal);
    return `0,${height} ${area} ${width},${height}`;
  }
}
