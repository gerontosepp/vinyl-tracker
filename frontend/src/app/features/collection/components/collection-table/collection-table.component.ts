import { Component, input, output, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { StorageSlotPipe } from '../../../../core/pipes/storage-slot.pipe';
import { FormatBadgeComponent } from '../format-badge/format-badge.component';
import { ManualBadgeComponent } from '../manual-badge/manual-badge.component';
import { CollectionRelease, QrCodeItem } from '../../../../core/types';
import { getFormatType, FormatType } from '../../utils/format-type.util';
import { getConditionShortCode } from '../../utils/condition.util';
import { LucideCheckSquare, LucideSquare, LucideExternalLink } from '@lucide/angular';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-collection-table',
  standalone: true,
  imports: [
    TooltipDirective,
    CommonModule,
    TranslatePipe,
    LocalizedDatePipe,
    StorageSlotPipe,
    FormatBadgeComponent,
    ManualBadgeComponent,
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

  /** The location column only appears once shelves are configured. */
  readonly showStorage = computed(() => this.releases().some((r) => r.storage));

  getFormatType(release: CollectionRelease): FormatType {
    return getFormatType(release);
  }
}
