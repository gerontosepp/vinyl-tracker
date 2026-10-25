import { Component, input, output, inject, signal, computed, linkedSignal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CollectionRelease, RecordDetailDto, RoonZone, TakeoverResult } from '../../../../core/types';
import {
  LucideExternalLink,
  LucideX,
  LucideHeadphones,
  LucideCheck,
  LucidePlay,
  LucideTrash2,
  LucideChevronDown,
  LucidePencil,
} from '@lucide/angular';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../../../core/pipes/localized-date.pipe';
import { StoragePlacementComponent } from '../../../../shared/components/storage-placement/storage-placement.component';
import { getErrorMessage } from '../../../../core/utils/error';
import { getConditionShortCode, MEDIA_CONDITION_OPTIONS, SLEEVE_CONDITION_OPTIONS } from '../../utils/condition.util';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { DiscogsTakeoverComponent } from '../discogs-takeover/discogs-takeover.component';

export const ROON_LAST_ZONE_KEY = 'vinyl_last_roon_zone_id';

@Component({
  selector: 'app-record-detail-modal',
  standalone: true,
  imports: [
    TooltipDirective,
    CommonModule,
    FormsModule,
    TranslatePipe,
    LocalizedDatePipe,
    StoragePlacementComponent,
    DiscogsTakeoverComponent,
    LucideExternalLink,
    LucideX,
    LucideHeadphones,
    LucideCheck,
    LucidePlay,
    LucideTrash2,
    LucideChevronDown,
    LucidePencil,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './record-detail-modal.component.html',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class RecordDetailModalComponent implements OnInit {
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly languageService = inject(LanguageService);
  readonly authService = inject(AuthService);
  readonly getConditionShortCode = getConditionShortCode;
  readonly mediaConditionOptions = MEDIA_CONDITION_OPTIONS;
  readonly sleeveConditionOptions = SLEEVE_CONDITION_OPTIONS;

  readonly record = input<CollectionRelease | null>(null);
  readonly detail = input<RecordDetailDto | null>(null);
  readonly loading = input<boolean>(false);

  readonly close = output<void>();
  readonly listenLogged = output<RecordDetailDto>();
  readonly conditionUpdated = output<RecordDetailDto>();
  readonly sortKeyUpdated = output<RecordDetailDto>();
  readonly recordRemoved = output<number>();
  /** Edit a manual record (#242) in the manual record form. */
  readonly editManual = output<RecordDetailDto>();
  /** A manual record became a Discogs record (#243). */
  readonly takenOver = output<TakeoverResult>();

  readonly isLoggingListen = signal<boolean>(false);
  readonly justListened = signal<boolean>(false);
  readonly isPlayingOnRoon = signal<boolean>(false);
  readonly isUpdatingCondition = signal<boolean>(false);
  readonly isSavingSortKey = signal<boolean>(false);
  readonly isRemoving = signal<boolean>(false);
  readonly showDeleteConfirm = signal<boolean>(false);

  /** Last takeover in this modal, shown with its shelf placement while its record is open. */
  readonly takeoverResult = signal<TakeoverResult | null>(null);
  readonly shownTakeover = computed(() => {
    const result = this.takeoverResult();
    return result && result.record.discogs_id === this.detail()?.discogs_id ? result : null;
  });

  readonly roonZones = signal<RoonZone[]>([]);
  readonly selectedZoneId = signal<string | null>(null);
  readonly isZoneDropdownOpen = signal<boolean>(false);
  readonly isLoadingZones = signal<boolean>(false);

  readonly selectedZone = computed(() => {
    const id = this.selectedZoneId();
    return this.roonZones().find((z) => z.zoneId === id) || null;
  });
  readonly hasMultipleZones = computed(() => this.roonZones().length > 1);

  /** Manual records have no Discogs page and are edited in the manual record form. */
  readonly isManual = computed(() => (this.detail()?.source ?? this.record()?.source) === 'manual');

  readonly currentMediaCondition = computed(() => this.detail()?.media_condition || this.record()?.media_condition || '');
  readonly currentSleeveCondition = computed(() => this.detail()?.sleeve_condition || this.record()?.sleeve_condition || '');
  readonly storedSortKey = computed(() => this.detail()?.sort_key ?? '');
  /** Edited sort string; follows the stored value whenever another record is shown. */
  readonly sortKeyValue = linkedSignal(() => this.storedSortKey());
  readonly sortKeyChanged = computed(() => this.sortKeyValue().trim() !== this.storedSortKey());
  private justListenedTimeout?: ReturnType<typeof setTimeout>;

  onTakenOver(result: TakeoverResult): void {
    this.takeoverResult.set(result);
    this.takenOver.emit(result);
  }

  onEditManual(): void {
    const detail = this.detail();
    if (detail) this.editManual.emit(detail);
  }

  ngOnInit(): void {
    if (this.authService.user()?.roonHost) {
      this.loadRoonZones();
    }
  }

  loadRoonZones(): void {
    this.isLoadingZones.set(true);
    this.apiService.getRoonZones().subscribe({
      next: (zones) => {
        const zoneList = zones || [];
        this.roonZones.set(zoneList);
        this.isLoadingZones.set(false);
        this.initSelectedZone(zoneList);
      },
      error: () => {
        this.isLoadingZones.set(false);
      },
    });
  }

  private initSelectedZone(zones: RoonZone[]): void {
    if (!zones.length) return;

    try {
      const lastSessionZoneId = sessionStorage.getItem(ROON_LAST_ZONE_KEY);
      if (lastSessionZoneId && zones.some((z) => z.zoneId === lastSessionZoneId)) {
        this.selectedZoneId.set(lastSessionZoneId);
        return;
      }
    } catch {
      // Ignore sessionStorage exceptions
    }

    const userDefaultZoneId = this.authService.user()?.roonZoneId;
    if (userDefaultZoneId && zones.some((z) => z.zoneId === userDefaultZoneId)) {
      this.selectedZoneId.set(userDefaultZoneId);
      return;
    }

    this.selectedZoneId.set(zones[0].zoneId);
  }

  toggleZoneDropdown(): void {
    this.isZoneDropdownOpen.update((v) => !v);
  }

  closeZoneDropdown(): void {
    this.isZoneDropdownOpen.set(false);
  }

  selectZone(zoneId: string): void {
    this.selectedZoneId.set(zoneId);
    try {
      sessionStorage.setItem(ROON_LAST_ZONE_KEY, zoneId);
    } catch {
      // Ignore
    }
    this.closeZoneDropdown();
  }

  selectAndPlay(zoneId: string): void {
    this.selectZone(zoneId);
    this.onPlayOnRoon();
  }

  /** Escape closes the delete confirmation first, then the modal. */
  onEscape(): void {
    if (!this.record()) return;
    if (this.showDeleteConfirm()) {
      this.cancelDelete();
    } else {
      this.close.emit();
    }
  }

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
    const zoneId = this.selectedZoneId() || undefined;

    if (!artist || !title || this.isPlayingOnRoon()) return;

    this.isPlayingOnRoon.set(true);
    this.apiService.playOnRoon({ artist, title, zoneId }).subscribe({
      next: () => {
        this.isPlayingOnRoon.set(false);
        const zoneName = this.selectedZone()?.name;
        const targetSuffix = zoneName ? ` (${zoneName})` : '';
        this.toastService.showToast(`Wiedergabe auf Roon gestartet${targetSuffix}: ${artist} - ${title} 🎶`, 'success');
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

  saveSortKey(): void {
    if (this.sortKeyChanged()) this.submitSortKey(this.sortKeyValue().trim() || null);
  }

  resetSortKey(): void {
    this.submitSortKey(null);
  }

  private submitSortKey(sortKey: string | null): void {
    const det = this.detail();
    const targetId = det?.id ?? det?.discogs_id ?? this.record()?.id;
    if (!targetId || this.isSavingSortKey()) return;

    this.isSavingSortKey.set(true);
    this.apiService.updateRecordSortKey(targetId, sortKey).subscribe({
      next: (updatedDetail) => {
        this.isSavingSortKey.set(false);
        this.toastService.showToast(this.languageService.translate('collection.sortKeyUpdated'), 'success');
        this.sortKeyUpdated.emit(updatedDetail);
      },
      error: (err) => {
        this.isSavingSortKey.set(false);
        this.toastService.showToast(
          getErrorMessage(err, this.languageService.translate('collection.sortKeyError')),
          'error'
        );
      },
    });
  }
}
