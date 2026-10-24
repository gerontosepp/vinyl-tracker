import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { FormatBadgeComponent } from '../format-badge/format-badge.component';
import { StorageSlotPipe } from '../../../../core/pipes/storage-slot.pipe';
import { CollectionRelease, QrCodeItem } from '../../../../core/types';
import { getFormatType, FormatType } from '../../utils/format-type.util';
import { getConditionShortCode } from '../../utils/condition.util';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

@Component({
  selector: 'app-collection-card-list',
  standalone: true,
  imports: [
    CommonModule,
    FormatBadgeComponent,
    StorageSlotPipe,
    TranslatePipe,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './collection-card-list.component.html',
})
export class CollectionCardListComponent {
  readonly apiService = inject(ApiService);

  readonly releases = input<CollectionRelease[]>([]);
  readonly selectedItems = input<Map<number, QrCodeItem>>(new Map());

  readonly toggleSelection = output<CollectionRelease>();
  readonly openDetail = output<CollectionRelease>();

  readonly getConditionShortCode = getConditionShortCode;

  getFormatType(release: CollectionRelease): FormatType {
    return getFormatType(release);
  }
}
