import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { LanguageService } from './language.service';
import { ToastService } from './toast.service';
import { getErrorMessage } from '../utils/error';
import { SyncResult, WantToHaveItem } from '../types';

/**
 * State of the Want-to-Have list (#310), shared by the list page, the label inbox and the
 * scanner so that "already on the list" hints stay in sync after every change.
 */
@Injectable({ providedIn: 'root' })
export class WantToHaveService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);
  /** User whose list is loaded; a different user (logout/login without reload) must not see it. */
  private loadedFor: number | null = null;

  readonly items = signal<WantToHaveItem[]>([]);
  readonly loaded = signal(false);
  readonly loadFailed = signal(false);
  /** Discogs IDs on the list. */
  readonly ids = computed(() => new Set(this.items().map((i) => i.discogs_id)));

  has(discogsId: number): boolean {
    return this.ids().has(discogsId);
  }

  async load(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.api.getWantToHave()));
      this.loadFailed.set(false);
      this.loadedFor = this.auth.user()?.id ?? null;
      this.loaded.set(true);
    } catch (error) {
      this.loadFailed.set(true);
      this.toast.showToast(getErrorMessage(error, this.language.translate('wantToHave.loadError')), 'error');
    }
  }

  /** Loads the list once per user; later calls reuse it. */
  async ensureLoaded(): Promise<void> {
    const userId = this.auth.user()?.id ?? null;
    if (this.loaded() && this.loadedFor === userId) return;
    if (this.loadedFor !== userId) {
      this.items.set([]);
      this.loaded.set(false);
    }
    await this.load();
  }

  /** Adds a release; returns whether it is on the list afterwards. */
  async add(discogsId: number, title: string): Promise<boolean> {
    try {
      const item = await firstValueFrom(this.api.addWantToHave(discogsId));
      this.items.update((list) => [item, ...list]);
      this.toast.showToast(this.language.translate('wantToHave.added', { title }), 'success');
      return true;
    } catch (error) {
      this.toast.showToast(getErrorMessage(error, this.language.translate('wantToHave.addError')), 'error');
      return false;
    }
  }

  async remove(item: WantToHaveItem): Promise<boolean> {
    try {
      await firstValueFrom(this.api.removeWantToHave(item.id));
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.toast.showToast(this.language.translate('wantToHave.removed'), 'success');
      return true;
    } catch (error) {
      this.toast.showToast(getErrorMessage(error, this.language.translate('wantToHave.removeError')), 'error');
      return false;
    }
  }

  /** Moves the record into the collection; returns the result (with shelf placement) or null. */
  async toCollection(item: WantToHaveItem): Promise<SyncResult | null> {
    try {
      const result = await firstValueFrom(this.api.wantToHaveToCollection(item.id));
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.toast.showToast(this.language.translate('wantToHave.movedToCollection', { title: item.title }), 'success');
      return result;
    } catch (error) {
      this.toast.showToast(getErrorMessage(error, this.language.translate('wantToHave.toCollectionError')), 'error');
      return null;
    }
  }
}
