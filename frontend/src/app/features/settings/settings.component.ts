import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, LayoutComponent],
  template: `
    <app-layout>
      <div class="max-w-6xl mx-auto space-y-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2 px-2">
          Profile & Settings
        </h1>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- LEFT COLUMN - USER PROFILE -->
          <div class="col-span-1 lg:col-span-5 space-y-6">
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-8 text-center transition-colors"
            >
              <div class="relative inline-block mb-4">
                <div
                  class="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center border-4 border-slate-50 dark:border-slate-900 shadow-inner overflow-hidden relative z-10"
                >
                  <span class="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {{ authService.user()?.username?.charAt(0)?.toUpperCase() }}
                  </span>
                </div>
                <div
                  class="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full blur-md opacity-20 -z-10 animate-pulse"
                ></div>
              </div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">
                {{ authService.user()?.username }}
              </h2>
              <p class="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                {{ authService.user()?.username }}&#64;vinyltracker.app
              </p>

              <div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-600">
                <button
                  (click)="logout()"
                  class="w-full py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN - SYSTEM SETTINGS -->
          <div class="col-span-1 lg:col-span-7 space-y-6">
            <!-- Appearance -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Appearance</h3>
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-slate-700 dark:text-slate-300">Theme Preference</h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Active mode</p>
                </div>
                <select
                  [ngModel]="themeService.theme()"
                  (ngModelChange)="onThemeChange($event)"
                  class="border border-slate-200 dark:border-slate-600 rounded-xl py-2 px-4 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 shadow-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            <!-- Discogs Integration -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Discogs Integration
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Manage your Discogs API connectivity for scanning and syncing your collection.
              </p>

              <form (ngSubmit)="handleSaveConnectivity()" #discogsForm="ngForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      name="discogsUsername"
                      [(ngModel)]="discogsUsername"
                      class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                    >
                      New Token
                    </label>
                    <input
                      type="password"
                      name="token"
                      [(ngModel)]="token"
                      placeholder="Enter only if changing"
                      class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div class="mt-4">
                  <label
                    class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    [(ngModel)]="password"
                    required
                    placeholder="Required to encrypt token"
                    class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all focus:border-amber-400"
                  />
                </div>

                <div
                  class="flex justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-600"
                >
                  <button
                    type="submit"
                    [disabled]="authService.isLoading() || !discogsForm.valid"
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    {{ authService.isLoading() ? 'Saving...' : 'Save Connectivity' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Data Management -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Data Management
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                Sync your collection manually or export your data.
              </p>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  (click)="forceSync()"
                  [disabled]="authService.isSyncing()"
                  class="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold px-4 py-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  Force Sync Collection
                </button>
                <button
                  (click)="showResetConfirm.set(true)"
                  [disabled]="authService.isSyncing()"
                  class="flex-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 font-bold px-4 py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  Reset All Listens
                </button>
                <button
                  class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  Export Data (CSV)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirm Dialog for Reset Listens -->
      @if (showResetConfirm()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 max-w-md animate-fade-in"
          >
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              Reset All Listening Events?
            </h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm mb-6">
              This will permanently delete all your listening history. This action cannot be undone.
            </p>
            <div class="flex gap-3">
              <button
                (click)="showResetConfirm.set(false)"
                class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                (click)="handleResetListens()"
                [disabled]="authService.isSyncing()"
                class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {{ authService.isSyncing() ? 'Resetting...' : 'Delete All' }}
              </button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class SettingsComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  discogsUsername = this.authService.user()?.discogsUsername || '';
  token = '';
  password = '';
  readonly showResetConfirm = signal<boolean>(false);

  onThemeChange(newTheme: Theme): void {
    this.themeService.setTheme(newTheme);
  }

  async handleSaveConnectivity(): Promise<void> {
    if (!this.password) {
      this.toastService.showToast('Current password is required to encrypt your token.', 'error');
      return;
    }

    try {
      await this.authService.updateDiscogs(this.discogsUsername, this.token, this.password);
      this.toastService.showToast('Settings updated successfully!', 'success');
      this.token = '';
      this.password = '';
    } catch (err) {
      this.toastService.showToast('Failed to update settings. Check your password.', 'error');
    }
  }

  forceSync(): void {
    this.authService.performSync();
  }

  async handleResetListens(): Promise<void> {
    this.showResetConfirm.set(false);
    try {
      await this.authService.resetAllListens();
    } catch (err) {
      // Handled in AuthService
    }
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}
