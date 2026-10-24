import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideX } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { IMAGE_DOWNSCALER } from '../../../core/utils/image';
import { getErrorMessage } from '../../../core/utils/error';
import { MEDIA_CONDITION_OPTIONS } from '../../../features/collection/utils/condition.util';
import { ManualRecordCreated, ManualRecordRequest, RecordDetailDto } from '../../../core/types';
import { StoragePlacementComponent } from '../storage-placement/storage-placement.component';
import { HelpLinkComponent } from '../help-link/help-link.component';

/** Formats a manual record can have (same labels as Discogs releases). */
export const MANUAL_FORMATS = ['LP', 'Double LP', 'CD', 'Double CD'] as const;

/** Values to start a new manual record with, e.g. read from a label photo or a scanned barcode. */
export interface ManualRecordPrefill {
  artist?: string | null;
  title?: string | null;
  format?: string | null;
  year?: string | null;
  label?: string | null;
  catno?: string | null;
  country?: string | null;
  barcode?: string | null;
  /** Label photo that becomes the cover and is completed on save. */
  labelPhotoId?: number | null;
}

interface FormModel {
  artist: string;
  title: string;
  format: string;
  year: string;
  label: string;
  catno: string;
  country: string;
  barcode: string;
  genres: string;
  mediaCondition: string;
  sleeveCondition: string;
  value: string;
  notes: string;
}

type TextField = keyof FormModel;

const YEAR_PATTERN = /^\d{4}$/;

function normalizeFormat(format: string | null | undefined): string {
  return MANUAL_FORMATS.find((f) => f.toLowerCase() === format?.trim().toLowerCase()) ?? 'LP';
}

function fromRecord(record: RecordDetailDto): FormModel {
  const label = record.labels[0];
  return {
    artist: record.artist ?? '',
    title: record.title ?? '',
    format: normalizeFormat(record.format),
    year: record.year ?? '',
    label: label?.name ?? '',
    catno: label?.catno ?? '',
    country: record.country ?? '',
    barcode: record.barcode ?? '',
    genres: record.genres.join(', '),
    mediaCondition: record.media_condition ?? '',
    sleeveCondition: record.sleeve_condition ?? '',
    value: record.median_price != null ? String(record.median_price) : '',
    notes: record.notes ?? '',
  };
}

function fromPrefill(prefill: ManualRecordPrefill | null): FormModel {
  return {
    artist: prefill?.artist ?? '',
    title: prefill?.title ?? '',
    format: normalizeFormat(prefill?.format),
    year: YEAR_PATTERN.test(prefill?.year ?? '') ? (prefill?.year ?? '') : '',
    label: prefill?.label ?? '',
    catno: prefill?.catno ?? '',
    country: prefill?.country ?? '',
    barcode: prefill?.barcode ?? '',
    genres: '',
    mediaCondition: '',
    sleeveCondition: '',
    value: '',
    notes: '',
  };
}

const optional = (value: string): string | null => value.trim() || null;

/**
 * Dialog to create or edit a manual record without a Discogs entry (#242), with cover upload.
 * After creating, it shows where the record goes on the shelf.
 */
@Component({
  selector: 'app-manual-record-form',
  standalone: true,
  imports: [TranslatePipe, LucideX, StoragePlacementComponent, HelpLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" (click)="close()">
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-record-title"
        data-testid="manual-record-form"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 id="manual-record-title" class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
            {{ (record() ? 'manual.editTitle' : 'manual.createTitle') | translate }}
            <app-help-link anchor="manuell" />
          </h3>
          <button
            type="button"
            (click)="close()"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            [attr.aria-label]="'common.close' | translate"
          >
            <svg lucideX [size]="18"></svg>
          </button>
        </div>

        @if (created(); as done) {
          <div class="space-y-4" data-testid="manual-record-saved">
            <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {{ 'manual.created' | translate: { title: done.record.title ?? '' } }}
            </p>
            @if (done.placement; as placement) {
              <app-storage-placement [slot]="placement.slot" [neighbors]="placement.neighbors" [moves]="placement.moves" />
            }
            <div class="flex justify-end">
              <button type="button" (click)="close()" [class]="primaryButton" data-testid="manual-record-done">
                {{ 'manual.done' | translate }}
              </button>
            </div>
          </div>
        } @else {
          <form class="space-y-4" (submit)="$event.preventDefault(); save()" novalidate>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'manual.intro' | translate }}</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="block">
                <span [class]="labelClass">{{ 'manual.artist' | translate }} *</span>
                <input [class]="inputClass" [value]="form().artist" (input)="set('artist', $event)" required data-testid="manual-artist" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.recordTitle' | translate }} *</span>
                <input [class]="inputClass" [value]="form().title" (input)="set('title', $event)" required data-testid="manual-title" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.format' | translate }} *</span>
                <select [class]="inputClass" (change)="set('format', $event)" data-testid="manual-format">
                  @for (format of formats; track format) {
                    <option [value]="format" [selected]="form().format === format">{{ format }}</option>
                  }
                </select>
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.year' | translate }}</span>
                <input
                  [class]="inputClass"
                  inputmode="numeric"
                  maxlength="4"
                  [value]="form().year"
                  (input)="set('year', $event)"
                  [attr.aria-invalid]="yearInvalid()"
                  data-testid="manual-year"
                />
                @if (yearInvalid()) {
                  <span class="text-xs text-red-600 dark:text-red-400">{{ 'manual.yearInvalid' | translate }}</span>
                }
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.label' | translate }}</span>
                <input [class]="inputClass" [value]="form().label" (input)="set('label', $event)" data-testid="manual-label" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.catno' | translate }}</span>
                <input [class]="inputClass" [value]="form().catno" (input)="set('catno', $event)" data-testid="manual-catno" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.country' | translate }}</span>
                <input [class]="inputClass" [value]="form().country" (input)="set('country', $event)" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.barcode' | translate }}</span>
                <input [class]="inputClass" inputmode="numeric" [value]="form().barcode" (input)="set('barcode', $event)" data-testid="manual-barcode" />
              </label>
              <label class="block sm:col-span-2">
                <span [class]="labelClass">{{ 'manual.genres' | translate }}</span>
                <input [class]="inputClass" [value]="form().genres" (input)="set('genres', $event)" [placeholder]="'manual.genresHint' | translate" />
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'collection.mediaCondition' | translate }}</span>
                <select [class]="inputClass" (change)="set('mediaCondition', $event)" data-testid="manual-media-condition">
                  <option value="" [selected]="!form().mediaCondition">–</option>
                  @for (condition of conditions; track condition) {
                    <option [value]="condition" [selected]="form().mediaCondition === condition">{{ condition }}</option>
                  }
                </select>
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'collection.sleeveCondition' | translate }}</span>
                <select [class]="inputClass" (change)="set('sleeveCondition', $event)">
                  <option value="" [selected]="!form().sleeveCondition">–</option>
                  @for (condition of conditions; track condition) {
                    <option [value]="condition" [selected]="form().sleeveCondition === condition">{{ condition }}</option>
                  }
                </select>
              </label>
              <label class="block">
                <span [class]="labelClass">{{ 'manual.value' | translate }}</span>
                <input
                  [class]="inputClass"
                  type="number"
                  min="0"
                  step="0.01"
                  inputmode="decimal"
                  [value]="form().value"
                  (input)="set('value', $event)"
                  data-testid="manual-value"
                />
              </label>
              <label class="block sm:col-span-2">
                <span [class]="labelClass">{{ 'manual.notes' | translate }}</span>
                <textarea [class]="inputClass" rows="2" maxlength="2000" [value]="form().notes" (input)="set('notes', $event)"></textarea>
              </label>
            </div>

            <!-- Cover -->
            <fieldset class="space-y-2">
              <legend [class]="labelClass">{{ 'manual.cover' | translate }}</legend>
              <div class="flex items-center gap-3">
                @if (coverPreview(); as preview) {
                  <img [src]="preview" alt="" class="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-600" data-testid="manual-cover-preview" />
                } @else if (record()?.thumb_url; as current) {
                  <img [src]="current" alt="" class="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
                }
                <label [class]="secondaryButton + ' cursor-pointer'">
                  {{ 'manual.chooseCover' | translate }}
                  <input type="file" accept="image/*" class="sr-only" (change)="pickCover($event)" data-testid="manual-cover-input" />
                </label>
              </div>
              @if (prefill()?.labelPhotoId && !cover()) {
                <p class="text-xs text-slate-500 dark:text-slate-400" data-testid="manual-label-photo-hint">
                  {{ 'manual.labelPhotoCover' | translate }}
                </p>
              }
            </fieldset>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" (click)="close()" [class]="secondaryButton">{{ 'print.cancel' | translate }}</button>
              <button type="submit" [disabled]="!valid() || saving()" [class]="primaryButton" data-testid="manual-record-save">
                {{ (saving() ? 'manual.saving' : 'manual.save') | translate }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
})
export class ManualRecordFormComponent {
  private readonly apiService = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly downscale = inject(IMAGE_DOWNSCALER);

  /** Manual record to edit; creates a new one when absent. */
  readonly record = input<RecordDetailDto | null>(null);
  readonly prefill = input<ManualRecordPrefill | null>(null);

  /** Emitted after every successful save, with the saved record. */
  readonly saved = output<RecordDetailDto>();
  readonly closed = output<void>();

  readonly formats = MANUAL_FORMATS;
  readonly conditions = MEDIA_CONDITION_OPTIONS;
  readonly labelClass = 'block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1';
  readonly inputClass =
    'w-full text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  readonly primaryButton =
    'px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer';
  readonly secondaryButton =
    'px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';

  readonly form = linkedSignal<FormModel>(() => {
    const record = this.record();
    return record ? fromRecord(record) : fromPrefill(this.prefill());
  });
  readonly cover = signal<Blob | null>(null);
  readonly coverPreview = signal<string | null>(null);
  readonly saving = signal(false);
  readonly created = signal<ManualRecordCreated | null>(null);

  readonly yearInvalid = computed(() => {
    const year = this.form().year.trim();
    return year !== '' && !YEAR_PATTERN.test(year);
  });
  readonly valid = computed(
    () => this.form().artist.trim() !== '' && this.form().title.trim() !== '' && !this.yearInvalid()
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  set(field: TextField, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  async pickCover(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const blob = await this.downscale(file);
      this.revokePreview();
      this.cover.set(blob);
      this.coverPreview.set(URL.createObjectURL(blob));
    } catch {
      this.toast.showToast(this.language.translate('manual.coverError'), 'error');
    }
  }

  async save(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      const existing = this.record();
      const request = this.request();
      let saved: RecordDetailDto;
      let created: ManualRecordCreated | null = null;
      if (existing) {
        saved = await firstValueFrom(this.apiService.updateManualRecord(existing.discogs_id, request));
      } else {
        created = await firstValueFrom(this.apiService.createManualRecord(request));
        saved = created.record;
      }
      const cover = this.cover();
      if (cover) {
        saved = await this.uploadCover(saved, cover);
      }
      this.saved.emit(saved);
      if (created) {
        this.toast.showToast(this.language.translate('manual.created', { title: saved.title ?? '' }), 'success');
        this.created.set({ ...created, record: saved });
      } else {
        this.toast.showToast(this.language.translate('manual.updated'), 'success');
        this.closed.emit();
      }
    } catch (error) {
      this.toast.showToast(getErrorMessage(error, this.language.translate('manual.saveError')), 'error');
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The record is already saved when the cover fails; it is not saved again (which would create
   * a second record), the cover can be added later in the record details.
   */
  private async uploadCover(record: RecordDetailDto, cover: Blob): Promise<RecordDetailDto> {
    try {
      return await firstValueFrom(this.apiService.uploadRecordCover(record.discogs_id, cover));
    } catch {
      this.toast.showToast(this.language.translate('manual.coverUploadError'), 'error');
      return record;
    }
  }

  close(): void {
    this.closed.emit();
  }

  private request(): ManualRecordRequest {
    const form = this.form();
    const value = form.value.trim() === '' ? null : Number(form.value);
    return {
      artist: form.artist.trim(),
      title: form.title.trim(),
      format: form.format,
      year: optional(form.year),
      label: optional(form.label),
      catno: optional(form.catno),
      country: optional(form.country),
      barcode: optional(form.barcode),
      genres: form.genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
      mediaCondition: optional(form.mediaCondition),
      sleeveCondition: optional(form.sleeveCondition),
      notes: optional(form.notes),
      value: value != null && Number.isFinite(value) ? value : null,
      // The label photo is completed and becomes the cover; an own cover replaces it afterwards
      labelPhotoId: this.prefill()?.labelPhotoId ?? null,
    };
  }

  private revokePreview(): void {
    const preview = this.coverPreview();
    if (preview) URL.revokeObjectURL(preview);
  }
}
