import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { FormatBadgeComponent } from '../format-badge/format-badge.component';
import { CollectionRelease, QrCodeItem } from '../../../../core/types';
import { getFormatType } from '../../utils/format-type.util';
import { LucideCheckSquare, LucideSquare, LucideExternalLink } from '@lucide/angular';

@Component({
  selector: 'app-collection-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    FormatBadgeComponent,
    LucideCheckSquare,
    LucideSquare,
    LucideExternalLink,
  ],
  templateUrl: './collection-table.component.html',
})
export class CollectionTableComponent {
  readonly apiService = inject(ApiService);

  readonly releases = input<CollectionRelease[]>([]);
  readonly selectedItems = input<Map<number, QrCodeItem>>(new Map());
  readonly isAllPageSelected = input<boolean>(false);

  readonly toggleSelection = output<CollectionRelease>();
  readonly toggleSelectAll = output<void>();
  readonly openDetail = output<CollectionRelease>();

  getFormatType(release: CollectionRelease): 'cd' | 'double_lp' | 'lp' {
    return getFormatType(release);
  }
}
