import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { CollectionRelease, RecordDetailDto } from '../../../../core/types';
import { LucideExternalLink, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-record-detail-modal',
  standalone: true,
  imports: [CommonModule, LucideExternalLink, LucideX],
  templateUrl: './record-detail-modal.component.html',
})
export class RecordDetailModalComponent {
  readonly apiService = inject(ApiService);

  readonly record = input<CollectionRelease | null>(null);
  readonly detail = input<RecordDetailDto | null>(null);
  readonly loading = input<boolean>(false);

  readonly close = output<void>();
}
