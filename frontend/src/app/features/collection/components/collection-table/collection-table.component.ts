import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { FormatBadgeComponent } from '../format-badge/format-badge.component';
import { CollectionRelease, QrCodeItem } from '../../../../core/types';
import { getFormatType, FormatType } from '../../utils/format-type.util';
import { getConditionShortCode } from '../../utils/condition.util';
import { LucideCheckSquare, LucideSquare, LucideExternalLink } from '@lucide/angular';

@Component({
  selector: 'app-collection-table',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LocalizedDatePipe,
    FormatBadgeComponent,
    LucideCheckSquare,
    LucideSquare,
    LucideExternalLink,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
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

  readonly getConditionShortCode = getConditionShortCode;

  getFormatType(release: CollectionRelease): FormatType {
    return getFormatType(release);
  }
}
