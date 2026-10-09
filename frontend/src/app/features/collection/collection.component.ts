import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { CollectionToolbarComponent } from './components/collection-toolbar/collection-toolbar.component';
import { CollectionTableComponent } from './components/collection-table/collection-table.component';
import { CollectionCardListComponent } from './components/collection-card-list/collection-card-list.component';
import { RecordDetailModalComponent } from './components/record-detail-modal/record-detail-modal.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { CollectionRelease, QrCodeItem, RecordDetailDto, GenreBreakdownItem } from '../../core/types';
import { getErrorMessage } from '../../core/utils/error';
import { getFormatType, FormatType } from './utils/format-type.util';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [
    CommonModule,
    LayoutComponent,
    CollectionToolbarComponent,
    CollectionTableComponent,
    CollectionCardListComponent,
    RecordDetailModalComponent,
  ],
  templateUrl: './collection.component.html',
})
export class CollectionComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);

  readonly selectedRecord = signal<CollectionRelease | null>(null);
  readonly recordDetail = signal<RecordDetailDto | null>(null);
  readonly loadingDetail = signal<boolean>(false);

  readonly page = signal<number>(1);
  readonly perPage = signal<number>(50);
  readonly totalPages = signal<number>(1);
  readonly totalItems = signal<number>(0);
  readonly releases = signal<CollectionRelease[]>([]);

  readonly loading = signal<boolean>(false);
  readonly generating = signal<boolean>(false);
  readonly search = signal<string>('');
  readonly debouncedSearch = signal<string>('');
  readonly loadStatus = signal<string>('');
  readonly showPlayedOnly = signal<boolean>(false);
  readonly sort = signal<string>('artist');
  readonly sortOrder = signal<string>('asc');
  readonly category = signal<'all' | 'vinyl' | 'cd'>('all');

  readonly availableGenres = signal<GenreBreakdownItem[]>([]);
  readonly selectedGenres = signal<string[]>([]);
  readonly years = signal<string>('');
  readonly debouncedYears = signal<string>('');

  readonly selectedItems = signal<Map<number, QrCodeItem>>(new Map());

  readonly isAllPageSelected = computed(() => {
    const rels = this.releases();
    const selected = this.selectedItems();
    return rels.length > 0 && rels.every((r) => selected.has(r.id));
  });

  readonly selectedCount = computed(() => this.selectedItems().size);

  private sub: Subscription | null = null;
  private searchTimer: any = null;
  private yearsTimer: any = null;

  ngOnInit(): void {
    this.loadGenres();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (this.yearsTimer) {
      clearTimeout(this.yearsTimer);
    }
  }

  loadGenres(): void {
    this.apiService.getGenreBreakdown().subscribe({
      next: (items) => this.availableGenres.set(items),
      error: (err) => console.error('Failed to load genres', err),
    });
  }

  loadData(): void {
    const user = this.authService.user();
    if (!user) return;

    if (this.sub) {
      this.sub.unsubscribe();
    }

    this.loading.set(true);
    const minPlays = this.showPlayedOnly() ? 1 : 0;

    this.sub = this.apiService
      .getCollection(
        this.page(),
        this.perPage(),
        minPlays,
        this.sort(),
        this.sortOrder(),
        this.debouncedSearch(),
        this.category(),
        this.selectedGenres(),
        this.debouncedYears()
      )
      .subscribe({
        next: (data) => {
          this.releases.set(data.releases);
          const loadedTime = new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());

          if (data.pagination) {
            this.totalPages.set(data.pagination.pages);
            this.totalItems.set(data.pagination.items);
            this.loadStatus.set(`${data.pagination.items} entries • ${loadedTime}`);
          } else {
            this.totalPages.set(1);
            this.totalItems.set(data.releases.length);
            this.loadStatus.set(`${data.releases.length} entries • ${loadedTime}`);
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.toastService.showToast(getErrorMessage(err, 'Failed to fetch collection'), 'error');
          this.loadStatus.set('Error loading');
          this.loading.set(false);
        },
      });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.debouncedSearch.set(value);
      this.page.set(1);
      this.loadData();
    }, 400);
  }

  clearSearch(): void {
    this.search.set('');
    this.debouncedSearch.set('');
    this.page.set(1);
    this.loadData();
  }

  toggleShowPlayedOnly(): void {
    this.showPlayedOnly.update((p) => !p);
    this.page.set(1);
    this.loadData();
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    if (value === 'listens') {
      this.sortOrder.set('desc');
    } else {
      this.sortOrder.set('asc');
    }
    this.page.set(1);
    this.loadData();
  }

  onCategoryChange(value: 'all' | 'vinyl' | 'cd'): void {
    if (this.category() === value) return;
    this.category.set(value);
    this.page.set(1);
    this.loadData();
  }

  onGenresChange(genres: string[]): void {
    this.selectedGenres.set(genres);
    this.page.set(1);
    this.loadData();
  }

  onYearsChange(value: string): void {
    this.years.set(value);
    if (this.yearsTimer) {
      clearTimeout(this.yearsTimer);
    }
    this.yearsTimer = setTimeout(() => {
      this.debouncedYears.set(value);
      this.page.set(1);
      this.loadData();
    }, 400);
  }

  clearAllFilters(): void {
    this.selectedGenres.set([]);
    this.years.set('');
    this.debouncedYears.set('');
    this.search.set('');
    this.debouncedSearch.set('');
    this.category.set('all');
    this.showPlayedOnly.set(false);
    this.page.set(1);
    this.loadData();
  }

  toggleSortOrder(): void {
    this.sortOrder.update((so) => (so === 'asc' ? 'desc' : 'asc'));
    this.page.set(1);
    this.loadData();
  }

  onPerPageChange(value: any): void {
    this.perPage.set(Number(value));
    this.page.set(1);
    this.loadData();
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
    this.loadData();
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
    this.loadData();
  }

  toggleSelection(release: CollectionRelease): void {
    const id = release.id;
    this.selectedItems.update((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(id)) {
        newMap.delete(id);
      } else {
        const artist = release.basic_information.artists?.[0]?.name || 'Unknown Artist';
        newMap.set(id, {
          id: release.id,
          title: release.basic_information.title,
          artist,
        });
      }
      return newMap;
    });
  }

  toggleSelectAllPage(): void {
    const allSelected = this.isAllPageSelected();
    this.selectedItems.update((prev) => {
      const newMap = new Map(prev);
      if (allSelected) {
        this.releases().forEach((r) => newMap.delete(r.id));
      } else {
        this.releases().forEach((r) => {
          const artist = r.basic_information.artists?.[0]?.name || 'Unknown Artist';
          newMap.set(r.id, {
            id: r.id,
            title: r.basic_information.title,
            artist,
          });
        });
      }
      return newMap;
    });
  }

  async handleDownloadSelected(): Promise<void> {
    if (this.selectedCount() === 0) return;
    this.generating.set(true);
    try {
      const items = Array.from(this.selectedItems().values());
      const blob = await firstValueFrom(this.apiService.downloadQrCodesSelected(items));
      this.downloadBlob(blob, 'selected_qr_codes.pdf');
      this.toastService.showToast('QR codes generated successfully', 'success');
    } catch (err) {
      console.error(err);
      this.toastService.showToast(getErrorMessage(err, 'Failed to generate QR codes.'), 'error');
    } finally {
      this.generating.set(false);
    }
  }

  openDetail(release: CollectionRelease): void {
    this.selectedRecord.set(release);
    this.recordDetail.set(null);
    this.loadingDetail.set(true);

    this.apiService.getRecordDetails(release.id).subscribe({
      next: (detail) => {
        this.recordDetail.set(detail);
        this.loadingDetail.set(false);
        if (detail.lowest_price != null) {
          this.releases.update((list) =>
            list.map((r) =>
              r.id === release.id
                ? {
                    ...r,
                    basic_information: {
                      ...r.basic_information,
                      lowest_price: detail.lowest_price,
                      num_for_sale: detail.num_for_sale,
                    },
                  }
                : r
            )
          );
        }
      },
      error: (err) => {
        console.error(err);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Laden der Details'), 'error');
        this.loadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.selectedRecord.set(null);
    this.recordDetail.set(null);
    this.loadingDetail.set(false);
  }

  onListenLogged(updated: RecordDetailDto): void {
    this.recordDetail.set(updated);
    this.releases.update((list) =>
      list.map((r) =>
        r.id === updated.discogs_id || (updated.id != null && r.id === updated.id)
          ? { ...r, listen_count: updated.listen_count }
          : r
      )
    );
  }

  getFormatType(release: CollectionRelease): FormatType {
    return getFormatType(release);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
