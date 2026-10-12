import { Component, input, output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { CollectionRelease, RecordDetailDto } from '../../../../core/types';
import { LucideExternalLink, LucideX, LucideHeadphones, LucideCheck, LucidePlay } from '@lucide/angular';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { getErrorMessage } from '../../../../core/utils/error';

@Component({
  selector: 'app-record-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    LocalizedDatePipe,
    LucideExternalLink,
    LucideX,
    LucideHeadphones,
    LucideCheck,
    LucidePlay,
  ],
  templateUrl: './record-detail-modal.component.html',
})
export class RecordDetailModalComponent {
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly languageService = inject(LanguageService);

  readonly record = input<CollectionRelease | null>(null);
  readonly detail = input<RecordDetailDto | null>(null);
  readonly loading = input<boolean>(false);

  readonly close = output<void>();
  readonly listenLogged = output<RecordDetailDto>();

  readonly isLoggingListen = signal<boolean>(false);
  readonly justListened = signal<boolean>(false);
  readonly isPlayingOnRoon = signal<boolean>(false);
  private justListenedTimeout?: ReturnType<typeof setTimeout>;

  onPlayOnRoon(): void {
    const rec = this.record();
    const det = this.detail();
    const artist = det?.artist || rec?.basic_information?.artists?.[0]?.name;
    const title = det?.title || rec?.basic_information?.title;

    if (!artist || !title || this.isPlayingOnRoon()) return;

    this.isPlayingOnRoon.set(true);
    this.apiService.playOnRoon({ artist, title }).subscribe({
      next: () => {
        this.isPlayingOnRoon.set(false);
        this.toastService.showToast(`Wiedergabe auf Roon gestartet: ${artist} - ${title} 🎶`, 'success');
      },
      error: (err) => {
        this.isPlayingOnRoon.set(false);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Starten der Roon-Wiedergabe'), 'error');
      },
    });
  }

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
