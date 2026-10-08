import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { FormatBadgeComponent } from '../format-badge/format-badge.component';
import { CollectionRelease, QrCodeItem } from '../../../../core/types';
import { getFormatType } from '../../utils/format-type.util';

@Component({
  selector: 'app-collection-card-list',
  standalone: true,
  imports: [
    CommonModule,
    FormatBadgeComponent,
  ],
  templateUrl: './collection-card-list.component.html',
})
export class CollectionCardListComponent {
  readonly apiService = inject(ApiService);

  readonly releases = input<CollectionRelease[]>([]);
  readonly selectedItems = input<Map<number, QrCodeItem>>(new Map());

  readonly toggleSelection = output<CollectionRelease>();
  readonly openDetail = output<CollectionRelease>();

  getFormatType(release: CollectionRelease): 'cd' | 'double_lp' | 'lp' {
    return getFormatType(release);
  }
}
