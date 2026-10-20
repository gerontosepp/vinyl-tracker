import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { getErrorMessage } from '../../../../core/utils/error';
import {
  RedistributePreview,
  StorageCompartment,
  StorageLayout,
  StorageMedia,
  StorageType,
  StorageUnit,
} from '../../../../core/types';

export interface StoragePreset {
  key: string;
  name: string;
  media: StorageMedia;
  rows: number;
  columns: number;
  capacity: number;
}

/** Common IKEA shelves; the capacity leaves some room for new records. */
export const STORAGE_PRESETS: StoragePreset[] = [
  { key: 'kallax-1x4', name: 'Kallax 1×4', media: 'vinyl', rows: 1, columns: 4, capacity: 70 },
  { key: 'kallax-2x2', name: 'Kallax 2×2', media: 'vinyl', rows: 2, columns: 2, capacity: 70 },
  { key: 'kallax-2x4', name: 'Kallax 2×4', media: 'vinyl', rows: 2, columns: 4, capacity: 70 },
  { key: 'kallax-4x4', name: 'Kallax 4×4', media: 'vinyl', rows: 4, columns: 4, capacity: 70 },
  { key: 'kallax-5x5', name: 'Kallax 5×5', media: 'vinyl', rows: 5, columns: 5, capacity: 70 },
  { key: 'ikea-cd', name: 'IKEA CD-Regal', media: 'cd', rows: 12, columns: 1, capacity: 11 },
];

interface TypeForm {
  id: number | null;
  preset: string;
  name: string;
  media: StorageMedia;
  rows: number;
  columns: number;
  capacity: number;
}

interface UnitForm {
  id: number | null;
  name: string;
  typeId: number | null;
}

const INPUT_CLASS =
  'w-full border border-slate-200 dark:border-slate-600 rounded-xl py-2 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none';

@Component({
  selector: 'app-storage-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="space-y-6">
      <p class="text-sm text-slate-600 dark:text-slate-400 font-medium px-2">{{ 'storage.intro' | translate }}</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Storage types -->
        <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 space-y-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ 'storage.typesTitle' | translate }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">{{ 'storage.typesDesc' | translate }}</p>
          </div>

          <ul class="divide-y divide-slate-100 dark:divide-slate-700" data-testid="type-list">
            @for (type of types(); track type.id) {
              <li class="py-2 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {{ type.name }}
                    <span class="text-xs font-medium text-slate-500">· {{ 'storage.media.' + type.media | translate }}</span>
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ 'storage.grid' | translate: { rows: type.rows, columns: type.columns, capacity: type.capacity } }}
                  </p>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button type="button" (click)="editType(type)" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                    {{ 'storage.edit' | translate }}
                  </button>
                  @if (type.unitCount === 0) {
                    <button type="button" (click)="deleteType(type)" class="text-xs font-bold text-red-600 dark:text-red-400 cursor-pointer">
                      {{ 'storage.delete' | translate }}
                    </button>
                  }
                </div>
              </li>
            } @empty {
              <li class="py-2 text-sm text-slate-500 dark:text-slate-400">{{ 'storage.noTypes' | translate }}</li>
            }
          </ul>

          @if (typeForm(); as form) {
            <form (ngSubmit)="saveType()" class="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4" data-testid="type-form">
              @if (form.id === null) {
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.preset' | translate }}
                  <select [class]="inputClass" name="preset" [ngModel]="form.preset" (ngModelChange)="applyPreset($event)">
                    @for (preset of presets; track preset.key) {
                      <option [value]="preset.key">{{ preset.name }}</option>
                    }
                    <option value="custom">{{ 'storage.presetCustom' | translate }}</option>
                  </select>
                </label>
              }
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                {{ 'storage.name' | translate }}
                <input [class]="inputClass" name="name" [(ngModel)]="form.name" required maxlength="100" />
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.media' | translate }}
                  <select [class]="inputClass" name="media" [(ngModel)]="form.media" [disabled]="form.id !== null">
                    <option value="vinyl">{{ 'storage.media.vinyl' | translate }}</option>
                    <option value="cd">{{ 'storage.media.cd' | translate }}</option>
                  </select>
                </label>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.rows' | translate }}
                  <input [class]="inputClass" type="number" name="rows" min="1" max="12" [(ngModel)]="form.rows" />
                </label>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.columns' | translate }}
                  <input [class]="inputClass" type="number" name="columns" min="1" max="12" [(ngModel)]="form.columns" />
                </label>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.capacity' | translate }}
                  <input [class]="inputClass" type="number" name="capacity" min="1" max="500" [(ngModel)]="form.capacity" />
                </label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'storage.capacityHint' | translate }}</p>
              <div class="flex gap-2">
                <button type="button" (click)="typeForm.set(null)" class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-xl cursor-pointer">
                  {{ 'storage.cancel' | translate }}
                </button>
                <button type="submit" [disabled]="saving()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl cursor-pointer">
                  {{ 'storage.save' | translate }}
                </button>
              </div>
            </form>
          } @else {
            <button type="button" (click)="startNewType()" data-testid="add-type" class="w-full py-2 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-bold text-sm cursor-pointer">
              + {{ 'storage.addType' | translate }}
            </button>
          }
        </section>

        <!-- Shelves -->
        <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 space-y-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ 'storage.unitsTitle' | translate }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">{{ 'storage.unitsDesc' | translate }}</p>
          </div>

          @for (media of mediaWithUnits(); track media) {
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{{ 'storage.media.' + media | translate }}</p>
              <ul class="divide-y divide-slate-100 dark:divide-slate-700" [attr.data-testid]="'unit-list-' + media">
                @for (unit of unitsOf(media); track unit.id; let first = $first; let last = $last) {
                  <li class="py-2 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-semibold text-slate-800 dark:text-slate-200 truncate">{{ unit.name }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">{{ typeName(unit.typeId) }}</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button type="button" (click)="moveUnit(unit, -1)" [disabled]="first" [attr.aria-label]="'storage.moveUp' | translate" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-30 cursor-pointer">↑</button>
                      <button type="button" (click)="moveUnit(unit, 1)" [disabled]="last" [attr.aria-label]="'storage.moveDown' | translate" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-30 cursor-pointer">↓</button>
                      <button type="button" (click)="editUnit(unit)" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">{{ 'storage.edit' | translate }}</button>
                      <button type="button" (click)="deleteUnit(unit)" class="text-xs font-bold text-red-600 dark:text-red-400 cursor-pointer">{{ 'storage.delete' | translate }}</button>
                    </div>
                  </li>
                }
              </ul>
            </div>
          } @empty {
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ 'storage.noUnits' | translate }}</p>
          }

          @if (unitForm(); as form) {
            <form (ngSubmit)="saveUnit()" class="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4" data-testid="unit-form">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.unitName' | translate }}
                  <input [class]="inputClass" name="unitName" [(ngModel)]="form.name" required maxlength="100" />
                </label>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  {{ 'storage.type' | translate }}
                  <select [class]="inputClass" name="typeId" [(ngModel)]="form.typeId">
                    @for (type of types(); track type.id) {
                      <option [ngValue]="type.id">{{ type.name }}</option>
                    }
                  </select>
                </label>
              </div>
              <div class="flex gap-2">
                <button type="button" (click)="unitForm.set(null)" class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-xl cursor-pointer">
                  {{ 'storage.cancel' | translate }}
                </button>
                <button type="submit" [disabled]="saving()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl cursor-pointer">
                  {{ 'storage.save' | translate }}
                </button>
              </div>
            </form>
          } @else if (types().length > 0) {
            <button type="button" (click)="startNewUnit()" data-testid="add-unit" class="w-full py-2 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-bold text-sm cursor-pointer">
              + {{ 'storage.addUnit' | translate }}
            </button>
          }
        </section>
      </div>

      <!-- Overview -->
      @for (media of layout()?.media ?? []; track media.media) {
        <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 space-y-4" [attr.data-testid]="'overview-' + media.media">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              {{ 'storage.overviewTitle' | translate }} · {{ 'storage.media.' + media.media | translate }}
            </h3>
            <button type="button" (click)="openRedistribute(media.media)" class="text-sm font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 cursor-pointer" [attr.data-testid]="'redistribute-' + media.media">
              {{ 'storage.redistribute' | translate }}
            </button>
          </div>
          @if (media.unplacedCount > 0) {
            <p class="text-sm font-semibold text-amber-700 dark:text-amber-300" data-testid="unplaced-count">
              {{ 'storage.unplacedCount' | translate: { count: media.unplacedCount } }}
            </p>
          }
          <div class="flex flex-wrap gap-6">
            @for (unit of media.units; track unit.id) {
              <div class="min-w-0">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{{ unit.name }} <span class="text-xs font-medium text-slate-500">· {{ unit.typeName }}</span></p>
                <div class="grid gap-1.5" [style.grid-template-columns]="'repeat(' + unit.columns + ', minmax(7rem, 1fr))'">
                  @for (c of unit.compartments; track c.number) {
                    <div class="rounded-lg border border-slate-200 dark:border-slate-600 p-2 bg-slate-50 dark:bg-slate-900/40 text-[11px] space-y-1" data-testid="compartment">
                      <div class="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                        <span>{{ 'storage.compartment' | translate: { number: c.number } }}</span>
                        <span [class.text-amber-600]="fillPercent(c) >= 100">{{ c.used }} / {{ c.capacity }}</span>
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div class="h-full rounded-full" [class]="fillPercent(c) >= 100 ? 'bg-amber-500' : 'bg-indigo-500'" [style.width.%]="fillPercent(c)"></div>
                      </div>
                      <p class="truncate text-slate-500 dark:text-slate-400" [title]="artistRange(c)">{{ artistRange(c) }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      @if (preview(); as p) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 max-w-md animate-fade-in" data-testid="redistribute-confirm">
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {{ 'storage.redistribute' | translate }} · {{ 'storage.media.' + p.media | translate }}
            </h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm mb-6">
              {{ 'storage.redistributePreview' | translate: { count: p.movedCount } }}
            </p>
            <div class="flex gap-3">
              <button type="button" (click)="preview.set(null)" class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl cursor-pointer">
                {{ 'storage.cancel' | translate }}
              </button>
              <button type="button" (click)="confirmRedistribute()" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer">
                {{ 'storage.redistributeConfirm' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class StorageSettingsComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  readonly presets = STORAGE_PRESETS;
  readonly inputClass = INPUT_CLASS;

  readonly types = signal<StorageType[]>([]);
  readonly units = signal<StorageUnit[]>([]);
  readonly layout = signal<StorageLayout | null>(null);
  readonly saving = signal(false);
  readonly typeForm = signal<TypeForm | null>(null);
  readonly unitForm = signal<UnitForm | null>(null);
  readonly preview = signal<RedistributePreview | null>(null);

  readonly mediaWithUnits = computed<StorageMedia[]>(() =>
    (['vinyl', 'cd'] as StorageMedia[]).filter((media) => this.units().some((u) => u.media === media))
  );

  ngOnInit(): void {
    forkJoin({
      types: this.apiService.getStorageTypes(),
      units: this.apiService.getStorageUnits(),
      layout: this.apiService.getStorageLayout(),
    }).subscribe({
      next: ({ types, units, layout }) => {
        this.types.set(types);
        this.units.set(units);
        this.layout.set(layout);
      },
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  unitsOf(media: StorageMedia): StorageUnit[] {
    return this.units().filter((u) => u.media === media);
  }

  typeName(typeId: number): string {
    return this.types().find((t) => t.id === typeId)?.name ?? '';
  }

  fillPercent(c: StorageCompartment): number {
    return Math.min(100, Math.round((c.used / c.capacity) * 100));
  }

  artistRange(c: StorageCompartment): string {
    if (c.count === 0) return this.languageService.translate('storage.empty');
    const first = c.firstArtist ?? '—';
    const last = c.lastArtist ?? '—';
    return first === last ? first : `${first} – ${last}`;
  }

  // --- Storage types ---

  startNewType(): void {
    const preset = this.presets[2];
    this.typeForm.set({ id: null, preset: preset.key, ...this.fromPreset(preset) });
  }

  applyPreset(key: string): void {
    const form = this.typeForm();
    const preset = this.presets.find((p) => p.key === key);
    if (!form) return;
    this.typeForm.set(preset ? { ...form, preset: key, ...this.fromPreset(preset) } : { ...form, preset: key });
  }

  editType(type: StorageType): void {
    this.typeForm.set({
      id: type.id,
      preset: 'custom',
      name: type.name,
      media: type.media,
      rows: type.rows,
      columns: type.columns,
      capacity: type.capacity,
    });
  }

  saveType(): void {
    const form = this.typeForm();
    if (!form) return;
    const request = {
      name: form.name,
      media: form.media,
      rows: Number(form.rows),
      columns: Number(form.columns),
      capacity: Number(form.capacity),
    };
    const call =
      form.id === null
        ? this.apiService.createStorageType(request)
        : this.apiService.updateStorageType(form.id, request);
    this.saving.set(true);
    call.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.types.set(result.types);
        this.typeForm.set(null);
        this.afterChange(result.redistributed);
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err, 'storage.loadError');
      },
    });
  }

  deleteType(type: StorageType): void {
    this.apiService.deleteStorageType(type.id).subscribe({
      next: (result) => this.types.set(result.types),
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  // --- Shelves ---

  startNewUnit(): void {
    const type = this.types()[0];
    this.unitForm.set({ id: null, name: '', typeId: type?.id ?? null });
  }

  editUnit(unit: StorageUnit): void {
    this.unitForm.set({ id: unit.id, name: unit.name, typeId: unit.typeId });
  }

  saveUnit(): void {
    const form = this.unitForm();
    if (!form || form.typeId === null) return;
    const call =
      form.id === null
        ? this.apiService.createStorageUnit(form.name, form.typeId)
        : this.apiService.updateStorageUnit(form.id, form.name, form.typeId);
    this.saving.set(true);
    call.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.unitForm.set(null);
        this.applyUnits(result.units, result.redistributed);
      },
      error: (err) => {
        this.saving.set(false);
        this.showError(err, 'storage.loadError');
      },
    });
  }

  deleteUnit(unit: StorageUnit): void {
    this.apiService.deleteStorageUnit(unit.id).subscribe({
      next: (result) => this.applyUnits(result.units, result.redistributed),
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  moveUnit(unit: StorageUnit, delta: -1 | 1): void {
    const ids = this.unitsOf(unit.media).map((u) => u.id);
    const index = ids.indexOf(unit.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.apiService.reorderStorageUnits(unit.media, ids).subscribe({
      next: (result) => this.applyUnits(result.units, result.redistributed),
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  // --- Redistribution ---

  openRedistribute(media: StorageMedia): void {
    this.apiService.previewRedistribution(media).subscribe({
      next: (preview) => this.preview.set(preview),
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  confirmRedistribute(): void {
    const preview = this.preview();
    if (!preview) return;
    this.apiService.redistribute(preview.media).subscribe({
      next: (layout) => {
        this.preview.set(null);
        this.layout.set(layout);
        this.toastService.showToast(this.languageService.translate('storage.redistributed'), 'success');
      },
      error: (err) => this.showError(err, 'storage.loadError'),
    });
  }

  private fromPreset(preset: StoragePreset): Omit<TypeForm, 'id' | 'preset'> {
    const { name, media, rows, columns, capacity } = preset;
    return { name, media, rows, columns, capacity };
  }

  private applyUnits(units: StorageUnit[], redistributed: StorageMedia[]): void {
    this.units.set(units);
    // Unit counts per type changed (delete button visibility).
    this.apiService.getStorageTypes().subscribe({ next: (types) => this.types.set(types) });
    this.afterChange(redistributed);
  }

  private afterChange(redistributed: StorageMedia[]): void {
    if (redistributed.length > 0) {
      this.toastService.showToast(this.languageService.translate('storage.redistributed'), 'info');
    } else {
      this.toastService.showToast(this.languageService.translate('storage.saved'), 'success');
    }
    this.apiService.getStorageLayout().subscribe({ next: (layout) => this.layout.set(layout) });
  }

  private showError(err: unknown, fallbackKey: string): void {
    this.toastService.showToast(getErrorMessage(err, this.languageService.translate(fallbackKey)), 'error');
  }
}

