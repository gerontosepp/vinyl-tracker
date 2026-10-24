import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { AppResumeService } from '../../core/services/app-resume.service';
import { getErrorMessage } from '../../core/utils/error';
import { LabelCandidate, LabelPhoto, StoragePlacement } from '../../core/types';
import { StoragePlacementComponent } from '../../shared/components/storage-placement/storage-placement.component';
import { LabelPhotoCardComponent } from './label-photo-card.component';

/** Maximum number of photos the backend returns per list request. */
const MAX_PHOTOS = 100;
/** Refresh interval while photos are being identified in the background. */
export const IDENTIFY_POLL_MS = 5000;

/**
 * Label inbox: shows the label photos waiting to be identified by Claude via MCP and lets the
 * user delete them one by one or all at once.
 */
@Component({
  selector: 'app-label-inbox',
  standalone: true,
  imports: [LayoutComponent, TranslatePipe, StoragePlacementComponent, LabelPhotoCardComponent],
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

        @if (lastAdded(); as added) {
          <div
            class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-3"
            role="status"
            data-testid="label-inbox-placement"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {{ 'labelInbox.placementTitle' | translate: { title: added.title } }}
              </p>
              <button
                type="button"
                (click)="lastAdded.set(null)"
                class="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
              >
                {{ 'labelInbox.dismiss' | translate }}
              </button>
            </div>
            <app-storage-placement
              [slot]="added.placement.slot"
              [neighbors]="added.placement.neighbors"
              [moves]="added.placement.moves"
              [showMoves]="true"
            />
          </div>
        }

        @if (confirmDeleteAll()) {
          <div
            role="alert"
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

        @if (inbox.isLoading() && !inbox.hasValue()) {
          <p class="text-sm text-slate-500">{{ 'labelInbox.loading' | translate }}</p>
        } @else if (inbox.error()) {
          <div class="flex flex-wrap items-center gap-3" role="alert" data-testid="label-inbox-error">
            <p class="text-sm font-semibold text-red-700 dark:text-red-300">{{ 'labelInbox.loadError' | translate }}</p>
            <button
              type="button"
              (click)="inbox.reload()"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {{ 'labelInbox.retry' | translate }}
            </button>
          </div>
        } @else if (photos().length === 0) {
          <p class="text-sm text-slate-500 dark:text-slate-400" data-testid="label-inbox-empty">
            {{ 'labelInbox.empty' | translate }}
          </p>
        } @else {
          <p
            class="text-sm font-semibold text-slate-700 dark:text-slate-300"
            aria-live="polite"
            data-testid="label-inbox-count-text"
          >
            {{ 'labelInbox.count' | translate: { count: pendingCount() } }}
          </p>
          <ul class="grid grid-cols-1 xl:grid-cols-2 gap-3">
            @for (photo of photos(); track photo.id) {
              <li>
                <app-label-photo-card
                  [photo]="photo"
                  [busy]="busy()"
                  [canIdentify]="canIdentify()"
                  (delete)="deletePhoto(photo)"
                  (identify)="identify(photo)"
                  (add)="add(photo, $event)"
                  (complete)="complete(photo, $event)"
                />
              </li>
            }
          </ul>
        }
      </div>
    </app-layout>
  `,
})
export class LabelInboxComponent {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  /** Pending photos; deletions update the loaded value locally instead of reloading. */
  readonly inbox = this.apiService.labelPhotosResource('pending', MAX_PHOTOS);
  readonly photos = computed<LabelPhoto[]>(() => (this.inbox.hasValue() ? this.inbox.value().photos : []));
  readonly pendingCount = computed(() => (this.inbox.hasValue() ? this.inbox.value().pendingCount : 0));
  readonly busy = signal(false);
  readonly confirmDeleteAll = signal(false);
  /** Photos whose release was added but which could not be completed yet (photo ID → release). */
  private readonly addedPhotos = new Map<number, number>();
  /** Placement of the record added last, shown until dismissed. */
  readonly lastAdded = signal<{ title: string; placement: StoragePlacement } | null>(null);

  private readonly openRouter = this.apiService.openRouterSettingsResource();
  readonly canIdentify = computed(() => this.openRouter.hasValue() && this.openRouter.value().hasApiKey);
  /** Photos are identified in the background; the list has to be refreshed until they are done. */
  readonly identifying = computed(() =>
    this.photos().some((p) => p.identifyState === 'queued' || p.identifyState === 'running')
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.identifying()) return;
      const timer = setInterval(() => this.inbox.reload(), IDENTIFY_POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
    inject(AppResumeService)
      .resumed$.pipe(takeUntilDestroyed())
      .subscribe(() => this.inbox.reload());
  }

  deletePhoto(photo: LabelPhoto): Promise<void> {
    return this.run('labelInbox.deleteError', async () => {
      await firstValueFrom(this.apiService.deleteLabelPhoto(photo.id));
      this.removeLocally(photo.id);
      this.toastService.showToast(this.languageService.translate('labelInbox.deleted'), 'success');
    });
  }

  identify(photo: LabelPhoto): Promise<void> {
    return this.run('labelInbox.actionError', async () => {
      const queued = await firstValueFrom(this.apiService.identifyLabelPhoto(photo.id));
      this.inbox.value.update((inbox) => inbox && { ...inbox, photos: inbox.photos.map((p) => (p.id === queued.id ? queued : p)) });
    });
  }

  /**
   * Adds the chosen release to the collection, completes the photo and shows the shelf slot.
   * If completing fails after the release was added, a retry only completes the photo instead
   * of adding a second copy.
   */
  add(photo: LabelPhoto, candidate: LabelCandidate): Promise<void> {
    return this.run('labelInbox.actionError', async () => {
      const title = `${candidate.artist ?? ''} – ${candidate.title ?? ''}`;
      if (!this.addedPhotos.has(photo.id)) {
        const result = await firstValueFrom(this.apiService.addReleaseToCollection(candidate.discogsId));
        this.addedPhotos.set(photo.id, candidate.discogsId);
        this.lastAdded.set(result.placement ? { title, placement: result.placement } : null);
      }
      const discogsId = this.addedPhotos.get(photo.id) ?? candidate.discogsId;
      await firstValueFrom(this.apiService.resolveLabelPhoto(photo.id, 'identified', discogsId));
      this.addedPhotos.delete(photo.id);
      this.removeLocally(photo.id);
      this.toastService.showToast(this.languageService.translate('labelInbox.added', { title }), 'success');
    });
  }

  complete(photo: LabelPhoto, candidate: LabelCandidate): Promise<void> {
    return this.run('labelInbox.actionError', async () => {
      await firstValueFrom(this.apiService.resolveLabelPhoto(photo.id, 'identified', candidate.discogsId));
      this.removeLocally(photo.id);
      this.toastService.showToast(this.languageService.translate('labelInbox.completed'), 'success');
    });
  }

  private removeLocally(photoId: number): void {
    this.inbox.value.update(
      (inbox) =>
        inbox && {
          photos: inbox.photos.filter((p) => p.id !== photoId),
          pendingCount: Math.max(0, inbox.pendingCount - 1),
        }
    );
  }

  /** Runs one inbox action at a time and reports a failure as a toast. */
  private async run(errorKey: string, action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      this.toastService.showToast(getErrorMessage(error, this.languageService.translate(errorKey)), 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteAll(): Promise<void> {
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.apiService.deleteLabelPhotos('pending'));
      this.inbox.value.set({ photos: [], pendingCount: result.pendingCount });
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
