import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { User } from '../types';
import { getErrorMessage } from '../utils/error';
import { firstValueFrom } from 'rxjs';

const AUTH_TOKEN_KEY = 'vinyl_auth_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);

  readonly user = signal<User | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isSyncing = signal<boolean>(false);

  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.checkCurrentUser();
  }

  private checkCurrentUser(): void {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      this.user.set(null);
      this.isLoading.set(false);
      return;
    }

    firstValueFrom(this.apiService.getUser())
      .then((u) => {
        if (u?.token) {
          localStorage.setItem(AUTH_TOKEN_KEY, u.token);
        }
        this.user.set(u);
      })
      .catch(() => {
        this.user.set(null);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      })
      .finally(() => {
        this.isLoading.set(false);
      });
  }

  async login(username: string, password: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const userData = await firstValueFrom(this.apiService.loginUser(username, password));
      if (userData?.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, userData.token);
      }
      this.user.set(userData);
      if (userData.discogsUsername) {
        this.performSync().catch(console.error);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async register(username: string, password: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const userData = await firstValueFrom(this.apiService.registerUser(username, password));
      if (userData?.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, userData.token);
      }
      this.user.set(userData);
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateDiscogs(discogsUsername: string, token: string, password?: string): Promise<void> {
    const currentUser = this.user();
    if (!currentUser) return;
    this.isLoading.set(true);
    try {
      const updatedUser = await firstValueFrom(
        this.apiService.updateDiscogsSettings(token, discogsUsername, password)
      );
      this.user.set(updatedUser);
      this.performSync().catch(console.error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.apiService.logoutUser());
    } catch (error) {
      console.error('Logout failed:', getErrorMessage(error, 'Unknown logout error'));
    } finally {
      this.user.set(null);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }

  async performSync(): Promise<void> {
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      this.isSyncing.set(true);
      try {
        const result = await firstValueFrom(this.apiService.forceSyncCollection());
        const added = result?.added || 0;
        const removed = result?.removed || 0;
        this.toastService.showToast(
          `Synced successfully! Added: ${added}, Removed: ${removed}`,
          'success'
        );
      } catch (error) {
        this.toastService.showToast(
          getErrorMessage(error, 'Failed to synchronize collection.'),
          'error'
        );
      } finally {
        this.isSyncing.set(false);
      }
    })();

    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  async resetAllListens(): Promise<number> {
    this.isSyncing.set(true);
    try {
      const result = await firstValueFrom(this.apiService.resetAllListens());
      const deletedCount = result.deletedCount || 0;
      this.toastService.showToast(
        `Successfully deleted ${deletedCount} listening events`,
        'success'
      );
      return deletedCount;
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, 'Failed to reset listening history.'),
        'error'
      );
      throw error;
    } finally {
      this.isSyncing.set(false);
    }
  }
}
