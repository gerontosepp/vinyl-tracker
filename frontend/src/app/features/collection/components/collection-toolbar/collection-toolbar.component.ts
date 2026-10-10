import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import {
  LucideDownload,
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
} from '@lucide/angular';

@Component({
  selector: 'app-collection-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LucideDownload,
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
  ],
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
  readonly generating = input<boolean>(false);
  readonly loadStatus = input<string>('');
  readonly loading = input<boolean>(false);
  readonly availableGenres = input<{ name: string; value: number }[]>([]);
  readonly selectedGenres = input<string[]>([]);
  readonly years = input<string>('');

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
  readonly downloadSelected = output<void>();
  readonly clearSelection = output<void>();
  readonly genresChange = output<string[]>();
  readonly yearsChange = output<string>();
  readonly clearAllFilters = output<void>();

  readonly isGenreDropdownOpen = signal<boolean>(false);
  readonly genreSearchTerm = signal<string>('');

  readonly filteredGenres = computed(() => {
    const list = this.availableGenres();
    const query = this.genreSearchTerm().trim().toLowerCase();
    if (!query) return list;
    return list.filter((g) => g.name.toLowerCase().includes(query));
  });

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
}
