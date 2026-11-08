import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
  /** Runs while a login/register/update request is in flight; gates the form buttons. */
  readonly isLoading = signal<boolean>(false);
  /** True until the start-up session check has settled; the auth guard waits for it. */
  readonly isCheckingSession = signal<boolean>(true);
  readonly isSyncing = signal<boolean>(false);

  private syncPromise: Promise<void> | null = null;

  constructor() {
    this.checkCurrentUser();
  }

  private checkCurrentUser(): void {
    const hadToken = localStorage.getItem(AUTH_TOKEN_KEY) !== null;
    // The backend authenticates via HttpOnly cookie too, so the check runs even without a
    // stored Bearer token; a 401 only means that there is no session.
    const loadSession = () => firstValueFrom(this.apiService.getUser(true));

    loadSession()
      .catch((error) => {
        // The backend prefers a Bearer token over the cookie. When a stale token was dropped
        // by the interceptor, retry once so a valid cookie session still signs the user in.
        if (hadToken && localStorage.getItem(AUTH_TOKEN_KEY) === null) {
          return loadSession();
        }
        throw error;
      })
      .then((u) => {
        if (u?.token) {
          localStorage.setItem(AUTH_TOKEN_KEY, u.token);
        }
        this.user.set(u);
      })
      .catch((error) => {
        this.user.set(null);
        // A network outage or server error must not discard a token that may still be valid
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      })
      .finally(() => {
        this.isCheckingSession.set(false);
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

  clearSession(): void {
    this.user.set(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.apiService.logoutUser());
    } catch (error) {
      console.error('Logout failed:', getErrorMessage(error, 'Unknown logout error'));
    } finally {
      this.clearSession();
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
