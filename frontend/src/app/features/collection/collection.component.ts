import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { CollectionToolbarComponent } from './components/collection-toolbar/collection-toolbar.component';
import { CollectionTableComponent } from './components/collection-table/collection-table.component';
import { CollectionCardListComponent } from './components/collection-card-list/collection-card-list.component';
import { RecordDetailModalComponent } from './components/record-detail-modal/record-detail-modal.component';
import { ShelfViewComponent } from './components/shelf-view/shelf-view.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { AppResumeService } from '../../core/services/app-resume.service';
import {
  CollectionRelease,
  QrCodeItem,
  RecordDetailDto,
  GenreBreakdownItem,
  PrintFilter,
  RecordSource,
  StorageShelfOption,
} from '../../core/types';
import { parseStorageFilter, shelfOptions } from '../../core/utils/storage-filter';
import { getErrorMessage } from '../../core/utils/error';
import { PrintDialogComponent } from '../../shared/components/print-dialog/print-dialog.component';
import { getFormatType, FormatType } from './utils/format-type.util';
import { Subscription } from 'rxjs';
import { HelpLinkComponent } from '../../shared/components/help-link/help-link.component';
import { ManualRecordFormComponent } from '../../shared/components/manual-record-form/manual-record-form.component';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [
    HelpLinkComponent,
    LayoutComponent,
    CollectionToolbarComponent,
    CollectionTableComponent,
    CollectionCardListComponent,
    RecordDetailModalComponent,
    PrintDialogComponent,
    ShelfViewComponent,
    NgTemplateOutlet,
    TranslatePipe,
    ManualRecordFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './collection.component.html',
})
export class CollectionComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly languageService = inject(LanguageService);
  private readonly route = inject(ActivatedRoute);

  /** Back from the background, records may have changed on another device. */
  private readonly resumeSub = inject(AppResumeService)
    .resumed$.pipe(takeUntilDestroyed())
    .subscribe(() => {
      this.loadShelves();
      this.loadData();
    });

  /** List of records or the shelf view (storage overview and management). */
  readonly view = signal<'list' | 'shelves'>('list');
  readonly viewOptions = ['list', 'shelves'] as const;

  readonly selectedRecord = signal<CollectionRelease | null>(null);
  readonly recordDetail = signal<RecordDetailDto | null>(null);
  readonly loadingDetail = signal<boolean>(false);

  readonly page = signal<number>(1);
  readonly perPage = signal<number>(50);
  readonly totalPages = signal<number>(1);
  readonly totalItems = signal<number>(0);
  readonly releases = signal<CollectionRelease[]>([]);

  readonly loading = signal<boolean>(false);
  readonly showPrintDialog = signal<boolean>(false);
  readonly search = signal<string>('');
  readonly debouncedSearch = signal<string>('');
  readonly loadStatus = signal<string>('');
  readonly showPlayedOnly = signal<boolean>(false);
  readonly notPlayedSince = signal<string>('');
  readonly unplayedOnly = signal<boolean>(false);
  readonly sort = signal<string>('artist');
  readonly sortOrder = signal<string>('asc');
  readonly category = signal<'all' | 'vinyl' | 'cd'>('all');

  readonly availableGenres = signal<GenreBreakdownItem[]>([]);
  readonly selectedGenres = signal<string[]>([]);
  readonly years = signal<string>('');
  readonly debouncedYears = signal<string>('');
  /** Shelves for the storage filter; empty without configured shelves. */
  readonly storageShelves = signal<StorageShelfOption[]>([]);
  /** Encoded storage filter, see `parseStorageFilter`. */
  readonly storageFilter = signal<string>('');
  readonly source = signal<RecordSource | ''>('');
  /** Open manual record form: a new record, or the one to edit. */
  readonly manualForm = signal<{ record: RecordDetailDto | null } | null>(null);

  readonly selectedItems = signal<Map<number, QrCodeItem>>(new Map());

  readonly isAllPageSelected = computed(() => {
    const rels = this.releases();
    const selected = this.selectedItems();
    return rels.length > 0 && rels.every((r) => selected.has(r.id));
  });

  readonly selectedCount = computed(() => this.selectedItems().size);
  readonly selectedIds = computed(() => Array.from(this.selectedItems().keys()));
  readonly selectedCdIds = computed(() =>
    Array.from(this.selectedItems().values())
      .filter((item) => item.isCd)
      .map((item) => item.id)
  );

  /** The collection view's current filters and sorting for the print dialog. */
  readonly printFilter = computed<PrintFilter>(() => {
    const filter: PrintFilter = { sort: this.sort(), sort_order: this.sortOrder() };
    const search = this.debouncedSearch();
    if (search) filter.search = search;
    if (this.category() !== 'all') filter.category = this.category();
    if (this.selectedGenres().length > 0) filter.genres = this.selectedGenres().join(',');
    const years = this.debouncedYears().trim();
    if (years) filter.years = years;
    if (this.notPlayedSince()) filter.not_played_since = this.notPlayedSince();
    if (this.unplayedOnly()) filter.unplayed_only = true;
    if (this.showPlayedOnly()) filter.min_plays = 1;
    const source = this.source();
    if (source) filter.source = source;
    return { ...filter, ...parseStorageFilter(this.storageFilter()) };
  });

  private sub: Subscription | null = null;
  private searchTimer: any = null;
  private yearsTimer: any = null;

  ngOnInit(): void {
    // e.g. /collection?search=Miles%20Davis from the dashboard's top artists
    const search = this.route.snapshot.queryParamMap.get('search')?.trim();
    if (search) {
      this.search.set(search);
      this.debouncedSearch.set(search);
    }
    this.loadGenres();
    this.loadShelves();
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

  /** Back in the list, slots may have changed (shelves edited or redistributed). */
  switchView(view: 'list' | 'shelves'): void {
    if (this.view() === view) return;
    this.view.set(view);
    if (view === 'list') {
      this.loadShelves();
      this.loadData();
    }
  }

  loadShelves(): void {
    this.apiService.getStorageLayout().subscribe({
      next: (layout) => {
        const shelves = shelfOptions(layout);
        this.storageShelves.set(shelves);
        // A deleted shelf must not keep filtering the list
        const unit = parseStorageFilter(this.storageFilter()).storage_unit;
        if (unit && unit !== 'unplaced' && !shelves.some((s) => String(s.id) === unit)) {
          this.storageFilter.set('');
          this.loadData();
        }
      },
      error: (err) => console.error('Failed to load shelves', err),
    });
  }

  onStorageFilterChange(value: string): void {
    this.storageFilter.set(value);
    this.page.set(1);
    this.loadData();
  }

  /** A compartment (or "without place") was clicked in the shelf overview. */
  openStorageFilter(value: string): void {
    this.storageFilter.set(value);
    this.page.set(1);
    this.switchView('list');
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
        this.debouncedYears(),
        this.notPlayedSince() || undefined,
        this.unplayedOnly(),
        { ...parseStorageFilter(this.storageFilter()), source: this.source() || undefined }
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
    const nextVal = !this.showPlayedOnly();
    this.showPlayedOnly.set(nextVal);
    if (nextVal) {
      this.unplayedOnly.set(false);
      this.notPlayedSince.set('');
    }
    this.page.set(1);
    this.loadData();
  }

  onNotPlayedSinceChange(date: string): void {
    this.notPlayedSince.set(date);
    if (date) {
      this.unplayedOnly.set(false);
      this.showPlayedOnly.set(false);
    }
    this.page.set(1);
    this.loadData();
  }

  toggleUnplayedOnly(): void {
    const nextVal = !this.unplayedOnly();
    this.unplayedOnly.set(nextVal);
    if (nextVal) {
      this.notPlayedSince.set('');
      this.showPlayedOnly.set(false);
    }
    this.page.set(1);
    this.loadData();
  }

  clearNotPlayedFilters(): void {
    this.notPlayedSince.set('');
    this.unplayedOnly.set(false);
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
    this.notPlayedSince.set('');
    this.unplayedOnly.set(false);
    this.storageFilter.set('');
    this.source.set('');
    this.page.set(1);
    this.loadData();
  }

  onSourceChange(value: RecordSource | ''): void {
    this.source.set(value);
    this.page.set(1);
    this.loadData();
  }

  /** A manual record was created or edited: refresh list and open detail. */
  onManualSaved(saved: RecordDetailDto): void {
    if (this.recordDetail()?.discogs_id === saved.discogs_id) {
      this.recordDetail.set(saved);
      this.selectedRecord.update(
        (rec) =>
          rec && {
            ...rec,
            basic_information: {
              ...rec.basic_information,
              title: saved.title ?? rec.basic_information.title,
              artists: saved.artist ? [{ name: saved.artist }] : rec.basic_information.artists,
              thumb: saved.thumb_url ?? rec.basic_information.thumb,
            },
          }
      );
    }
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
        newMap.set(id, this.toSelectionItem(release));
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
        this.releases().forEach((r) => newMap.set(r.id, this.toSelectionItem(r)));
      }
      return newMap;
    });
  }

  clearSelection(): void {
    this.selectedItems.set(new Map());
  }

  openDetail(release: CollectionRelease): void {
    this.selectedRecord.set(release);
    this.recordDetail.set(null);
    this.loadingDetail.set(true);

    this.apiService.getRecordDetails(release.id).subscribe({
      next: (detail) => {
        this.recordDetail.set(detail);
        this.loadingDetail.set(false);
        if (detail.lowest_price != null || detail.median_price != null) {
          this.releases.update((list) =>
            list.map((r) =>
              r.id === release.id
                ? {
                    ...r,
                    basic_information: {
                      ...r.basic_information,
                      lowest_price: detail.lowest_price != null ? detail.lowest_price : r.basic_information?.lowest_price,
                      median_price: detail.median_price != null ? detail.median_price : r.basic_information?.median_price,
                      num_for_sale: detail.num_for_sale != null ? detail.num_for_sale : r.basic_information?.num_for_sale,
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

  /** A changed sort string moves the record in the artist order and on the shelf. */
  onSortKeyUpdated(updated: RecordDetailDto): void {
    this.recordDetail.set(updated);
    this.loadData();
  }

  onConditionUpdated(updated: RecordDetailDto): void {
    this.recordDetail.set(updated);
    if (this.selectedRecord()) {
      this.selectedRecord.update((rec) =>
        rec
          ? {
              ...rec,
              media_condition: updated.media_condition,
              sleeve_condition: updated.sleeve_condition,
              basic_information: {
                ...rec.basic_information,
                median_price: updated.median_price != null ? updated.median_price : rec.basic_information?.median_price,
              },
            }
          : null
      );
    }
    this.releases.update((list) =>
      list.map((r) =>
        r.id === updated.discogs_id || (updated.id != null && r.id === updated.id)
          ? {
              ...r,
              media_condition: updated.media_condition,
              sleeve_condition: updated.sleeve_condition,
              basic_information: {
                ...r.basic_information,
                median_price: updated.median_price != null ? updated.median_price : r.basic_information?.median_price,
              },
            }
          : r
      )
    );
  }

  onRecordRemoved(releaseId: number): void {
    this.closeDetail();
    this.selectedItems.update((map) => {
      const next = new Map(map);
      next.delete(releaseId);
      return next;
    });
    this.releases.update((list) => list.filter((r) => r.id !== releaseId));
    this.totalItems.update((total) => Math.max(0, total - 1));
  }

  private toSelectionItem(release: CollectionRelease): QrCodeItem {
    const format = getFormatType(release);
    return {
      id: release.id,
      title: release.basic_information.title,
      artist: release.basic_information.artists?.[0]?.name || 'Unknown Artist',
      isCd: format === 'cd' || format === 'double_cd',
    };
  }

  getFormatType(release: CollectionRelease): FormatType {
    return getFormatType(release);
  }
}
