import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy, HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { RecordSource, StorageShelfOption } from '../../../../core/types';
import { parseStorageFilter } from '../../../../core/utils/storage-filter';
import {
  LucidePrinter,
  LucideArrowUp,
  LucideArrowDown,
  LucideSearch,
  LucideX,
  LucideDisc,
  LucideDiscAlbum,
  LucideTag,
  LucideCalendar,
  LucideChevronDown,
  LucideArchive,
  LucideSlidersHorizontal,
  LucidePlus,
  LucideDatabase,
} from '@lucide/angular';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-collection-toolbar',
  standalone: true,
  imports: [
    TooltipDirective,
    FormsModule,
    TranslatePipe,
    LucidePrinter,
    LucideArrowUp,
    LucideArrowDown,
    LucideSearch,
    LucideX,
    LucideDisc,
    LucideDiscAlbum,
    LucideTag,
    LucideCalendar,
    LucideChevronDown,
    LucideArchive,
    LucideSlidersHorizontal,
    LucidePlus,
    LucideDatabase,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './collection-toolbar.component.html',
})
export class CollectionToolbarComponent {
  readonly search = input<string>('');
  readonly sort = input<string>('artist');
  readonly sortOrder = input<string>('asc');
  readonly category = input<'all' | 'vinyl' | 'cd'>('all');
  readonly totalItems = input<number>(0);
  readonly page = input<number>(1);
  readonly perPage = input<number>(50);
  readonly totalPages = input<number>(1);
  readonly selectedCount = input<number>(0);
  readonly showPlayedOnly = input<boolean>(false);
  readonly notPlayedSince = input<string>('');
  readonly unplayedOnly = input<boolean>(false);
  readonly loadStatus = input<string>('');
  readonly loading = input<boolean>(false);
  readonly availableGenres = input<{ name: string; value: number }[]>([]);
  readonly selectedGenres = input<string[]>([]);
  readonly years = input<string>('');
  readonly storageShelves = input<StorageShelfOption[]>([]);
  /** Encoded storage filter, see `parseStorageFilter`. */
  readonly storageFilter = input<string>('');
  /** Source filter; empty lists Discogs releases and manual records. */
  readonly source = input<RecordSource | ''>('');

  readonly searchChange = output<string>();
  readonly clearSearch = output<void>();
  readonly sortChange = output<string>();
  readonly sortOrderToggle = output<void>();
  readonly categoryChange = output<'all' | 'vinyl' | 'cd'>();
  readonly perPageChange = output<number>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();
  readonly toggleShowPlayedOnly = output<void>();
  readonly notPlayedSinceChange = output<string>();
  readonly toggleUnplayedOnly = output<void>();
  readonly clearNotPlayedFilters = output<void>();
  readonly printRequested = output<void>();
  readonly clearSelection = output<void>();
  readonly genresChange = output<string[]>();
  readonly yearsChange = output<string>();
  readonly storageFilterChange = output<string>();
  readonly clearAllFilters = output<void>();
  readonly sourceChange = output<RecordSource | ''>();
  readonly addManual = output<void>();

  private readonly languageService = inject(LanguageService);

  readonly isFilterPopoverOpen = signal<boolean>(false);
  readonly genreSearchTerm = signal<string>('');

  /** Filters that live inside the popover (category and search stay outside). */
  readonly activeFilterCount = computed(
    () =>
      this.selectedGenres().length +
      (this.years().trim() ? 1 : 0) +
      (this.storageFilter() ? 1 : 0) +
      (this.source() ? 1 : 0) +
      (this.showPlayedOnly() ? 1 : 0) +
      (this.unplayedOnly() || this.notPlayedSince().trim() ? 1 : 0),
  );

  readonly hasLoadError = computed(() => /error|fehler/i.test(this.loadStatus()));

  /** "1–50 von 661" label for the pager. */
  readonly rangeLabel = computed(() => {
    const total = this.totalItems();
    if (total <= 0) return '';
    const from = (this.page() - 1) * this.perPage() + 1;
    const to = Math.min(this.page() * this.perPage(), total);
    return this.languageService.translate('collection.rangeOf', { from, to, total });
  });

  readonly filteredGenres = computed(() => {
    const list = this.availableGenres();
    const query = this.genreSearchTerm().trim().toLowerCase();
    if (!query) return list;
    return list.filter((g) => g.name.toLowerCase().includes(query));
  });

  /** Label of the active storage filter for the filter badge. */
  readonly storageFilterLabel = computed(() => {
    const { storage_unit, compartment } = parseStorageFilter(this.storageFilter());
    if (!storage_unit) return '';
    if (storage_unit === 'unplaced') return this.languageService.translate('storage.unplaced');
    const shelf = this.storageShelves().find((s) => String(s.id) === storage_unit);
    const name = shelf?.name ?? storage_unit;
    return compartment
      ? `${name} · ${this.languageService.translate('storage.compartment', { number: compartment })}`
      : name;
  });

  /** 1..n for the compartment options of a shelf. */
  compartmentNumbers(shelf: StorageShelfOption): number[] {
    return Array.from({ length: shelf.compartments }, (_, i) => i + 1);
  }

  toggleFilterPopover(): void {
    this.isFilterPopoverOpen.update((open) => !open);
  }

  closeFilterPopover(): void {
    this.isFilterPopoverOpen.set(false);
  }

  /** Closes the popover on any click outside of it (the sticky bar blocks a full-page overlay). */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isFilterPopoverOpen()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-testid="filters-toggle"]') || target?.closest('[data-testid="filter-popover"]')) {
      return;
    }
    this.closeFilterPopover();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeFilterPopover();
  }

  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  onSortSelect(value: string): void {
    this.sortChange.emit(value);
  }

  onPerPageSelect(value: any): void {
    this.perPageChange.emit(Number(value));
  }

  isGenreSelected(name: string): boolean {
    return this.selectedGenres().includes(name);
  }

  toggleGenre(name: string): void {
    const current = this.selectedGenres();
    if (current.includes(name)) {
      this.genresChange.emit(current.filter((g) => g !== name));
    } else {
      this.genresChange.emit([...current, name]);
    }
  }

  clearGenres(): void {
    this.genresChange.emit([]);
  }

  onYearsInput(value: string): void {
    this.yearsChange.emit(value);
  }

  clearYears(): void {
    this.yearsChange.emit('');
  }

  onNotPlayedSinceSelect(value: string): void {
    this.notPlayedSinceChange.emit(value);
  }

  onToggleUnplayedOnly(): void {
    this.toggleUnplayedOnly.emit();
  }

  /** Clears all play-status filters inside the popover. */
  clearPlayStatusFilters(): void {
    if (this.showPlayedOnly()) this.toggleShowPlayedOnly.emit();
    if (this.unplayedOnly() || this.notPlayedSince().trim()) this.clearNotPlayedFilters.emit();
  }

  /** Clears every filter inside the popover, leaving search and category untouched. */
  resetFilters(): void {
    if (this.selectedGenres().length > 0) this.genresChange.emit([]);
    if (this.years().trim()) this.yearsChange.emit('');
    if (this.source()) this.sourceChange.emit('');
    if (this.storageFilter()) this.storageFilterChange.emit('');
    this.clearPlayStatusFilters();
  }
}
