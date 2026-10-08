import { Component, input, output } from '@angular/core';
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
  ],
  templateUrl: './collection-toolbar.component.html',
})
export class CollectionToolbarComponent {
  readonly search = input<string>('');
  readonly sort = input<string>('artist');
  readonly sortOrder = input<string>('asc');
  readonly page = input<number>(1);
  readonly perPage = input<number>(50);
  readonly totalPages = input<number>(1);
  readonly selectedCount = input<number>(0);
  readonly isAllPageSelected = input<boolean>(false);
  readonly showPlayedOnly = input<boolean>(false);
  readonly generating = input<boolean>(false);
  readonly loadStatus = input<string>('');
  readonly loading = input<boolean>(false);

  readonly searchChange = output<string>();
  readonly clearSearch = output<void>();
  readonly sortChange = output<string>();
  readonly sortOrderToggle = output<void>();
  readonly perPageChange = output<number>();
  readonly prevPage = output<void>();
  readonly nextPage = output<void>();
  readonly toggleSelectAllPage = output<void>();
  readonly toggleShowPlayedOnly = output<void>();
  readonly downloadSelected = output<void>();

  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  onSortSelect(value: string): void {
    this.sortChange.emit(value);
  }

  onPerPageSelect(value: any): void {
    this.perPageChange.emit(Number(value));
  }
}
