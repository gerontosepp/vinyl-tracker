import { Component, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CollectionRelease, RecordDetailDto } from '../../../../core/types';
import { LucideExternalLink, LucideX, LucideHeadphones, LucideCheck } from '@lucide/angular';
import { getErrorMessage } from '../../../../core/utils/error';

@Component({
  selector: 'app-record-detail-modal',
  standalone: true,
  imports: [CommonModule, LucideExternalLink, LucideX, LucideHeadphones, LucideCheck],
  templateUrl: './record-detail-modal.component.html',
})
export class RecordDetailModalComponent {
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);

  readonly record = input<CollectionRelease | null>(null);
  readonly detail = input<RecordDetailDto | null>(null);
  readonly loading = input<boolean>(false);

  readonly close = output<void>();
  readonly listenLogged = output<RecordDetailDto>();

  readonly isLoggingListen = signal<boolean>(false);
  readonly justListened = signal<boolean>(false);
  private justListenedTimeout?: ReturnType<typeof setTimeout>;

  onLogListen(): void {
    const rec = this.record();
    const det = this.detail();
    const targetId = det?.id ?? det?.discogs_id ?? rec?.id;
    if (!targetId || this.isLoggingListen()) return;

    this.isLoggingListen.set(true);
    this.apiService.logRecordListen(targetId).subscribe({
      next: (updatedDetail) => {
        this.isLoggingListen.set(false);
        this.justListened.set(true);
        const title = updatedDetail.title || rec?.basic_information?.title || 'Platte';
        this.toastService.showToast(
          `Hör-Event für "${title}" erfasst! 🎵`,
          'success'
        );
        this.listenLogged.emit(updatedDetail);
        if (this.justListenedTimeout) clearTimeout(this.justListenedTimeout);
        this.justListenedTimeout = setTimeout(() => this.justListened.set(false), 3000);
      },
      error: (err) => {
        this.isLoggingListen.set(false);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Erfassen des Hör-Events'), 'error');
      },
    });
  }
}
