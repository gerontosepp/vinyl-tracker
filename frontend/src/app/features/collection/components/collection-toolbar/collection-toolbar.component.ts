import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { StorageShelfOption } from '../../../../core/types';
import { parseStorageFilter } from '../../../../core/utils/storage-filter';
import {
  LucidePrinter,
  LucideCheckSquare,
  LucideSquare,
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
} from '@lucide/angular';

const FILTERS_OPEN_KEY = 'collection.filtersOpen';

function readFiltersOpen(): boolean {
  try {
    return localStorage.getItem(FILTERS_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-collection-toolbar',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    LucidePrinter,
    LucideCheckSquare,
    LucideSquare,
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
  readonly isAllPageSelected = input<boolean>(false);
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

  readonly searchChange = output<string>();
  readonly clearSearch = output<void>();
  readonly sortChange = output<string>();
  readonly sortOrderToggle = output<void>();
  readonly categoryChange = output<'all' | 'vinyl' | 'cd'>();
  readonly perPageChange = output<number>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();
  readonly toggleSelectAllPage = output<void>();
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

  private readonly languageService = inject(LanguageService);

  readonly isGenreDropdownOpen = signal<boolean>(false);
  readonly isNotPlayedPopoverOpen = signal<boolean>(false);
  readonly genreSearchTerm = signal<string>('');
  /** Phone only: filters, sorting and page size are collapsed so just the search stays visible. */
  readonly filtersOpen = signal<boolean>(readFiltersOpen());

  readonly collapsibleClass = computed(() => (this.filtersOpen() ? '' : 'max-md:hidden'));

  readonly activeFilterCount = computed(
    () =>
      (this.category() !== 'all' ? 1 : 0) +
      this.selectedGenres().length +
      (this.years().trim() ? 1 : 0) +
      (this.storageFilter() ? 1 : 0) +
      (this.showPlayedOnly() ? 1 : 0) +
      (this.unplayedOnly() || this.notPlayedSince().trim() ? 1 : 0),
  );

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

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
    try {
      localStorage.setItem(FILTERS_OPEN_KEY, String(this.filtersOpen()));
    } catch {
      // Storage unavailable: the state just isn't remembered
    }
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

  toggleGenreDropdown(): void {
    this.isGenreDropdownOpen.update((open) => !open);
  }

  closeGenreDropdown(): void {
    this.isGenreDropdownOpen.set(false);
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

  toggleNotPlayedPopover(): void {
    this.isNotPlayedPopoverOpen.update((open) => !open);
  }

  closeNotPlayedPopover(): void {
    this.isNotPlayedPopoverOpen.set(false);
  }

  onNotPlayedSinceSelect(value: string): void {
    this.notPlayedSinceChange.emit(value);
  }

  onToggleUnplayedOnly(): void {
    this.toggleUnplayedOnly.emit();
  }

  onClearNotPlayed(): void {
    this.clearNotPlayedFilters.emit();
  }
}
