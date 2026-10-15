import { Component, input, output, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { CollectionRelease, RecordDetailDto } from '../../../../core/types';
import { LucideExternalLink, LucideX, LucideHeadphones, LucideCheck, LucidePlay, LucideTrash2 } from '@lucide/angular';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { getErrorMessage } from '../../../../core/utils/error';
import { getConditionShortCode, MEDIA_CONDITION_OPTIONS, SLEEVE_CONDITION_OPTIONS } from '../../utils/condition.util';

@Component({
  selector: 'app-record-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LocalizedDatePipe,
    LucideExternalLink,
    LucideX,
    LucideHeadphones,
    LucideCheck,
    LucidePlay,
    LucideTrash2,
  ],
  templateUrl: './record-detail-modal.component.html',
})
export class RecordDetailModalComponent {
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly languageService = inject(LanguageService);
  readonly getConditionShortCode = getConditionShortCode;
  readonly mediaConditionOptions = MEDIA_CONDITION_OPTIONS;
  readonly sleeveConditionOptions = SLEEVE_CONDITION_OPTIONS;

  readonly record = input<CollectionRelease | null>(null);
  readonly detail = input<RecordDetailDto | null>(null);
  readonly loading = input<boolean>(false);

  readonly close = output<void>();
  readonly listenLogged = output<RecordDetailDto>();
  readonly conditionUpdated = output<RecordDetailDto>();
  readonly recordRemoved = output<number>();

  readonly isLoggingListen = signal<boolean>(false);
  readonly justListened = signal<boolean>(false);
  readonly isPlayingOnRoon = signal<boolean>(false);
  readonly isUpdatingCondition = signal<boolean>(false);
  readonly isRemoving = signal<boolean>(false);
  readonly showDeleteConfirm = signal<boolean>(false);
  readonly currentMediaCondition = computed(() => this.detail()?.media_condition || this.record()?.media_condition || '');
  readonly currentSleeveCondition = computed(() => this.detail()?.sleeve_condition || this.record()?.sleeve_condition || '');
  private justListenedTimeout?: ReturnType<typeof setTimeout>;

  promptDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  confirmDelete(): void {
    const rec = this.record();
    const det = this.detail();
    const releaseId = det?.discogs_id ?? rec?.id;
    const instanceId = det?.instance_id ?? rec?.instance_id;

    if (!releaseId || this.isRemoving()) return;

    this.isRemoving.set(true);
    this.apiService.removeReleaseFromCollection(releaseId, instanceId).subscribe({
      next: () => {
        this.isRemoving.set(false);
        this.showDeleteConfirm.set(false);
        this.toastService.showToast(
          this.languageService.translate('collection.deleteSuccess'),
          'success'
        );
        this.recordRemoved.emit(releaseId);
      },
      error: (err) => {
        this.isRemoving.set(false);
        this.toastService.showToast(
          getErrorMessage(err, this.languageService.translate('collection.deleteError')),
          'error'
        );
      },
    });
  }



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

  onMediaConditionChange(newValue: string): void {
    const current = this.detail()?.media_condition || this.record()?.media_condition || '';
    if (!newValue || newValue === current || this.isUpdatingCondition()) return;

    const rec = this.record();
    const det = this.detail();
    const targetId = det?.id ?? det?.discogs_id ?? rec?.id;
    if (!targetId) return;

    this.isUpdatingCondition.set(true);
    this.apiService.updateRecordCondition(targetId, { media_condition: newValue }).subscribe({
      next: (updatedDetail) => {
        this.isUpdatingCondition.set(false);
        this.toastService.showToast(
          this.languageService.translate('collection.conditionUpdated') || 'Zustand erfolgreich aktualisiert 💿',
          'success'
        );
        this.conditionUpdated.emit(updatedDetail);
      },
      error: (err) => {
        this.isUpdatingCondition.set(false);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Aktualisieren des Zustands'), 'error');
      },
    });
  }

  onSleeveConditionChange(newValue: string): void {
    const current = this.detail()?.sleeve_condition || this.record()?.sleeve_condition || '';
    if (!newValue || newValue === current || this.isUpdatingCondition()) return;

    const rec = this.record();
    const det = this.detail();
    const targetId = det?.id ?? det?.discogs_id ?? rec?.id;
    if (!targetId) return;

    this.isUpdatingCondition.set(true);
    this.apiService.updateRecordCondition(targetId, { sleeve_condition: newValue }).subscribe({
      next: (updatedDetail) => {
        this.isUpdatingCondition.set(false);
        this.toastService.showToast(
          this.languageService.translate('collection.conditionUpdated') || 'Zustand erfolgreich aktualisiert 💿',
          'success'
        );
        this.conditionUpdated.emit(updatedDetail);
      },
      error: (err) => {
        this.isUpdatingCondition.set(false);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Aktualisieren des Zustands'), 'error');
      },
    });
  }
}
