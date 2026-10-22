import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { LocalizedDatePipe } from '../../core/pipes/localized-date.pipe';
import { getErrorMessage } from '../../core/utils/error';
import { LabelPhoto } from '../../core/types';

/** Maximum number of photos the backend returns per list request. */
const MAX_PHOTOS = 100;

/**
 * Label inbox: shows the label photos waiting to be identified by Claude via MCP and lets the
 * user delete them one by one or all at once.
 */
@Component({
  selector: 'app-label-inbox',
  standalone: true,
  imports: [LayoutComponent, TranslatePipe, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout [fullWidth]="false">
      <div class="space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold tracking-tight">{{ 'labelInbox.title' | translate }}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ 'labelInbox.intro' | translate }}</p>
          </div>
          @if (photos().length > 0 && !confirmDeleteAll()) {
            <button
              type="button"
              data-testid="label-inbox-delete-all"
              (click)="confirmDeleteAll.set(true)"
              [disabled]="busy()"
              class="px-3 py-2 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              {{ 'labelInbox.deleteAll' | translate }}
            </button>
          }
        </div>

        @if (confirmDeleteAll()) {
          <div
            class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30"
            data-testid="label-inbox-confirm"
          >
            <span class="text-sm font-medium text-red-800 dark:text-red-200">
              {{ 'labelInbox.deleteAllConfirm' | translate: { count: pendingCount() } }}
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="confirmDeleteAll.set(false)"
                class="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-800"
              >
                {{ 'labelInbox.cancel' | translate }}
              </button>
              <button
                type="button"
                data-testid="label-inbox-confirm-delete-all"
                (click)="deleteAll()"
                [disabled]="busy()"
                class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {{ 'labelInbox.deleteAll' | translate }}
              </button>
            </div>
          </div>
        }

        @if (loading()) {
          <p class="text-sm text-slate-500">{{ 'labelInbox.loading' | translate }}</p>
        } @else if (photos().length === 0) {
          <p class="text-sm text-slate-500 dark:text-slate-400" data-testid="label-inbox-empty">
            {{ 'labelInbox.empty' | translate }}
          </p>
        } @else {
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300" data-testid="label-inbox-count-text">
            {{ 'labelInbox.count' | translate: { count: pendingCount() } }}
          </p>
          <ul class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            @for (photo of photos(); track photo.id) {
              <li
                class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col"
                data-testid="label-inbox-photo"
              >
                <a [href]="imageUrl(photo)" target="_blank" rel="noopener" class="block aspect-square bg-slate-100 dark:bg-slate-900">
                  <img
                    [src]="imageUrl(photo)"
                    [alt]="'labelInbox.photoAlt' | translate: { date: (photo.createdAt | localizedDate: 'short') ?? '' }"
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                </a>
                <div class="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span class="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {{ photo.createdAt | localizedDate: 'short' }}
                  </span>
                  <button
                    type="button"
                    data-testid="label-inbox-delete"
                    (click)="deletePhoto(photo)"
                    [disabled]="busy()"
                    class="px-2 py-1 rounded-md text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    {{ 'labelInbox.delete' | translate }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </app-layout>
  `,
})
export class LabelInboxComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  readonly photos = signal<LabelPhoto[]>([]);
  readonly pendingCount = signal(0);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly confirmDeleteAll = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  imageUrl(photo: LabelPhoto): string {
    return this.apiService.labelPhotoImageUrl(photo.id);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const inbox = await firstValueFrom(this.apiService.getLabelPhotos('pending', MAX_PHOTOS));
      this.photos.set(inbox.photos);
      this.pendingCount.set(inbox.pendingCount);
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('labelInbox.loadError')),
        'error'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async deletePhoto(photo: LabelPhoto): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.apiService.deleteLabelPhoto(photo.id));
      this.photos.update((photos) => photos.filter((p) => p.id !== photo.id));
      this.pendingCount.update((count) => Math.max(0, count - 1));
      this.toastService.showToast(this.languageService.translate('labelInbox.deleted'), 'success');
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('labelInbox.deleteError')),
        'error'
      );
    } finally {
      this.busy.set(false);
    }
  }

  async deleteAll(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.apiService.deleteLabelPhotos('pending'));
      this.photos.set([]);
      this.pendingCount.set(result.pendingCount);
      this.toastService.showToast(
        this.languageService.translate('labelInbox.deletedAll', { count: result.deleted }),
        'success'
      );
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('labelInbox.deleteError')),
        'error'
      );
    } finally {
      this.busy.set(false);
      this.confirmDeleteAll.set(false);
    }
  }
}
