import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { ApiService } from '../../core/services/api.service';
import { WantToHaveService } from '../../core/services/want-to-have.service';
import { RecordDetailDto, WantToHaveItem } from '../../core/types';
import { RecordDetailModalComponent } from '../collection/components/record-detail-modal/record-detail-modal.component';
import { toCollectionRelease } from '../collection/components/record-detail-modal/record-ref';
import { HelpLinkComponent } from '../../shared/components/help-link/help-link.component';

/**
 * Want-to-Have (#310): records found via label recognition or scan that the user wants to listen
 * to before owning them. Playing on Roon does not log a listen.
 */
@Component({
  selector: 'app-want-to-have',
  standalone: true,
  imports: [LayoutComponent, TranslatePipe, RecordDetailModalComponent, HelpLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout [fullWidth]="false">
      <div class="space-y-5">
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-1">
            {{ 'wantToHave.title' | translate }}
            <app-help-link anchor="want-to-have" />
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ 'wantToHave.intro' | translate }}</p>
        </div>

        @if (!wantToHave.loaded() && !wantToHave.loadFailed()) {
          <p class="text-sm text-slate-500">{{ 'wantToHave.loading' | translate }}</p>
        } @else if (wantToHave.loadFailed() && !wantToHave.loaded()) {
          <div class="flex flex-wrap items-center gap-3" role="alert" data-testid="want-to-have-error">
            <p class="text-sm font-semibold text-red-700 dark:text-red-300">{{ 'wantToHave.loadError' | translate }}</p>
            <button
              type="button"
              (click)="wantToHave.load()"
              class="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {{ 'labelInbox.retry' | translate }}
            </button>
          </div>
        } @else if (wantToHave.items().length === 0) {
          <p class="text-sm text-slate-500 dark:text-slate-400" data-testid="want-to-have-empty">
            {{ 'wantToHave.empty' | translate }}
          </p>
        } @else {
          <ul class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            @for (item of wantToHave.items(); track item.id) {
              <li>
                <button
                  type="button"
                  (click)="open(item)"
                  data-testid="want-to-have-item"
                  class="w-full flex gap-3 p-3 text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                >
                  @if (item.thumb_url) {
                    <img [src]="item.thumb_url" alt="" class="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" />
                  } @else {
                    <span class="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-900 shrink-0" aria-hidden="true"></span>
                  }
                  <span class="min-w-0">
                    <span class="block font-semibold text-slate-900 dark:text-slate-100 truncate">{{ item.title }}</span>
                    <span class="block text-sm text-slate-600 dark:text-slate-300 truncate">{{ item.artist }}</span>
                    <span class="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {{ meta(item) }}
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <app-record-detail-modal
        mode="wantToHave"
        [record]="selectedRecord()"
        [detail]="detail()"
        [loading]="loadingDetail()"
        [isWantBusy]="busy()"
        [wantToHaveId]="selected()?.id ?? null"
        (close)="closeDetail()"
        (addToCollection)="addToCollection()"
        (removeWanted)="removeWanted()"
      />
    </app-layout>
  `,
})
export class WantToHaveComponent {
  private readonly api = inject(ApiService);
  readonly wantToHave = inject(WantToHaveService);

  readonly selected = signal<WantToHaveItem | null>(null);
  readonly selectedRecord = signal<ReturnType<typeof toCollectionRelease> | null>(null);
  readonly detail = signal<RecordDetailDto | null>(null);
  readonly loadingDetail = signal(false);
  readonly busy = signal(false);

  constructor() {
    void this.wantToHave.load();
  }

  meta(item: WantToHaveItem): string {
    return [item.year, item.format].filter(Boolean).join(' · ');
  }

  async open(item: WantToHaveItem): Promise<void> {
    this.selected.set(item);
    this.selectedRecord.set(
      toCollectionRelease({ discogsId: item.discogs_id, title: item.title, artist: item.artist, thumbUrl: item.thumb_url })
    );
    this.detail.set(null);
    this.loadingDetail.set(true);
    try {
      const detail = await firstValueFrom(this.api.getRecordDetails(item.discogs_id));
      // Ignore a late answer for a record that is no longer shown
      if (this.selected()?.id === item.id) this.detail.set(detail);
    } catch {
      // The header still shows what the list knows; the details stay empty
    } finally {
      if (this.selected()?.id === item.id) this.loadingDetail.set(false);
    }
  }

  closeDetail(): void {
    this.selected.set(null);
    this.selectedRecord.set(null);
    this.detail.set(null);
    this.loadingDetail.set(false);
  }

  async addToCollection(): Promise<void> {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    try {
      if (await this.wantToHave.toCollection(item)) this.closeDetail();
    } finally {
      this.busy.set(false);
    }
  }

  async removeWanted(): Promise<void> {
    const item = this.selected();
    if (!item || this.busy()) return;
    this.busy.set(true);
    try {
      if (await this.wantToHave.remove(item)) this.closeDetail();
    } finally {
      this.busy.set(false);
    }
  }
}
