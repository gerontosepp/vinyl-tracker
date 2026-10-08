import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { LanguageService, Language } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { RoonStatus } from '../../core/types';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, LayoutComponent, TranslatePipe],
  template: `
    <app-layout>
      <div class="max-w-6xl mx-auto space-y-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2 px-2">
          {{ 'settings.title' | translate }}
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
                  {{ 'nav.logout' | translate }}
                </button>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN - SYSTEM SETTINGS -->
          <div class="col-span-1 lg:col-span-7 space-y-6">
            <!-- Appearance & Language -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors space-y-6"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                {{ 'settings.appearance' | translate }}
              </h3>

              <!-- Language Preference -->
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-slate-700 dark:text-slate-300">
                    {{ 'settings.language' | translate }}
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {{ 'settings.languageDesc' | translate }}
                  </p>
                </div>
                <select
                  [ngModel]="languageService.language()"
                  (ngModelChange)="onLanguageChange($event)"
                  class="border border-slate-200 dark:border-slate-600 rounded-xl py-2 px-4 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 shadow-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                >
                  <option value="de">Deutsch 🇩🇪</option>
                  <option value="en">English 🇬🇧</option>
                </select>
              </div>

              <div class="border-t border-slate-100 dark:border-slate-700/50 pt-4 flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-slate-700 dark:text-slate-300">
                    {{ 'settings.theme' | translate }}
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {{ 'settings.themeDesc' | translate }}
                  </p>
                </div>
                <select
                  [ngModel]="themeService.theme()"
                  (ngModelChange)="onThemeChange($event)"
                  class="border border-slate-200 dark:border-slate-600 rounded-xl py-2 px-4 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 shadow-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                >
                  <option value="light">{{ 'settings.themeLight' | translate }}</option>
                  <option value="dark">{{ 'settings.themeDark' | translate }}</option>
                  <option value="system">{{ 'settings.themeSystem' | translate }}</option>
                </select>
              </div>
            </div>

            <!-- Discogs Integration -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                {{ 'settings.discogsTitle' | translate }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                {{ 'settings.discogsDesc' | translate }}
              </p>

              <form (ngSubmit)="handleSaveConnectivity()" #discogsForm="ngForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                    >
                      {{ 'settings.username' | translate }}
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
                      {{ 'settings.newToken' | translate }}
                    </label>
                    <input
                      type="password"
                      name="token"
                      [(ngModel)]="token"
                      [placeholder]="'settings.tokenPlaceholder' | translate"
                      class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div class="mt-4">
                  <label
                    class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
                  >
                    {{ 'settings.currentPassword' | translate }}
                  </label>
                  <input
                    type="password"
                    name="password"
                    [(ngModel)]="password"
                    required
                    [placeholder]="'settings.passwordPlaceholder' | translate"
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
                    {{ (authService.isLoading() ? 'settings.saving' : 'settings.saveConnectivity') | translate }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Roon Integration -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <div class="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {{ 'settings.roonTitle' | translate }}
                  </h3>
                  <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {{ 'settings.roonDesc' | translate }}
                  </p>
                </div>
                <!-- Status Badges -->
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  @if (roonStatus()?.connected) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {{ 'settings.roonConnected' | translate }}
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-400">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      {{ 'settings.roonDisconnected' | translate }}
                    </span>
                  }

                  @if (roonStatus()?.paired) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {{ 'settings.roonPaired' | translate }}
                    </span>
                  } @else if (roonStatus()?.connected) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="{{ 'settings.roonUnpaired' | translate }}">
                      ⚠️ Autorisierung nötig
                    </span>
                  }
                </div>
              </div>

              @if (roonStatus()?.coreName) {
                <div class="mb-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Core: <span class="font-bold text-slate-700 dark:text-slate-300">{{ roonStatus()?.coreName }}</span>
                </div>
              }

              <form (ngSubmit)="handleSaveRoon()" #roonForm="ngForm" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="md:col-span-2">
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      {{ 'settings.roonHost' | translate }}
                    </label>
                    <input
                      type="text"
                      name="roonHost"
                      [(ngModel)]="roonHost"
                      placeholder="z.B. 192.168.1.50"
                      class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      {{ 'settings.roonPort' | translate }}
                    </label>
                    <input
                      type="number"
                      name="roonPort"
                      [(ngModel)]="roonPort"
                      min="1"
                      max="65535"
                      class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {{ 'settings.roonZone' | translate }}
                    </label>
                    <button
                      type="button"
                      (click)="handleRefreshZones()"
                      [disabled]="isLoadingZones() || !roonStatus()?.connected"
                      class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 cursor-pointer"
                    >
                      {{ (isLoadingZones() ? '...' : ('settings.roonRefreshZones' | translate)) }}
                    </button>
                  </div>
                  <select
                    name="roonZoneId"
                    [(ngModel)]="roonZoneId"
                    class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                  >
                    <option value="">{{ 'settings.roonSelectZone' | translate }}</option>
                    @for (z of (roonStatus()?.zones || []); track z.zoneId) {
                      <option [value]="z.zoneId">{{ z.name }} ({{ z.state }})</option>
                    }
                  </select>
                </div>

                <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-600">
                  <button
                    type="submit"
                    [disabled]="isSavingRoon()"
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  >
                    {{ (isSavingRoon() ? 'settings.saving' : 'settings.roonSave') | translate }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Data Management -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                {{ 'settings.dataManagement' | translate }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                {{ 'settings.dataDesc' | translate }}
              </p>

              <div class="flex flex-col sm:flex-row gap-3">
                <button
                  (click)="forceSync()"
                  [disabled]="authService.isSyncing()"
                  class="flex-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold px-4 py-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {{ 'settings.forceSync' | translate }}
                </button>
                <button
                  (click)="showResetConfirm.set(true)"
                  [disabled]="authService.isSyncing()"
                  class="flex-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 font-bold px-4 py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {{ 'settings.resetListens' | translate }}
                </button>
                <button
                  class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  {{ 'settings.exportCsv' | translate }}
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
              {{ 'settings.resetConfirmTitle' | translate }}
            </h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm mb-6">
              {{ 'settings.resetConfirmText' | translate }}
            </p>
            <div class="flex gap-3">
              <button
                (click)="showResetConfirm.set(false)"
                class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ 'settings.cancel' | translate }}
              </button>
              <button
                (click)="handleResetListens()"
                [disabled]="authService.isSyncing()"
                class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {{ (authService.isSyncing() ? 'settings.deleting' : 'settings.delete') | translate }}
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
  readonly apiService = inject(ApiService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  discogsUsername = this.authService.user()?.discogsUsername || '';
  token = '';
  password = '';
  readonly showResetConfirm = signal<boolean>(false);

  // Roon Integration
  roonHost = this.authService.user()?.roonHost || '';
  roonPort = this.authService.user()?.roonPort || 9330;
  roonZoneId = this.authService.user()?.roonZoneId || '';
  readonly roonStatus = signal<RoonStatus | null>(null);
  readonly isSavingRoon = signal<boolean>(false);
  readonly isLoadingZones = signal<boolean>(false);

  constructor() {
    this.loadRoonStatus();
  }

  loadRoonStatus(): void {
    this.apiService.getRoonStatus().subscribe({
      next: (status) => {
        this.roonStatus.set(status);
        if (status.host) {
          this.roonHost = status.host;
        }
        if (status.port) {
          this.roonPort = status.port;
        }
        if (status.selectedZoneId) {
          this.roonZoneId = status.selectedZoneId;
        } else if (status.zones && status.zones.length > 0 && !this.roonZoneId) {
          const userZone = this.authService.user()?.roonZoneId;
          if (userZone) {
            this.roonZoneId = userZone;
          }
        }
      },
      error: () => {
        // Silently ignore if not configured or offline
      },
    });
  }

  handleRefreshZones(): void {
    this.isLoadingZones.set(true);
    this.apiService.getRoonZones().subscribe({
      next: (zones) => {
        this.isLoadingZones.set(false);
        const cur = this.roonStatus();
        if (cur) {
          this.roonStatus.set({ ...cur, zones });
        }
        this.toastService.showToast('Roon-Zonen aktualisiert', 'success');
      },
      error: () => {
        this.isLoadingZones.set(false);
        this.toastService.showToast('Zonen konnten nicht geladen werden', 'error');
      },
    });
  }

  handleSaveRoon(): void {
    this.isSavingRoon.set(true);
    const selectedZone = this.roonStatus()?.zones?.find((z) => z.zoneId === this.roonZoneId);

    this.apiService
      .updateRoonSettings({
        roonHost: this.roonHost,
        roonPort: this.roonPort,
        roonZoneId: this.roonZoneId,
        roonZoneName: selectedZone?.name,
      })
      .subscribe({
        next: (status) => {
          this.isSavingRoon.set(false);
          this.roonStatus.set(status);
          if (status.host) {
            this.roonHost = status.host;
          }
          if (status.port) {
            this.roonPort = status.port;
          }
          if (status.selectedZoneId) {
            this.roonZoneId = status.selectedZoneId;
          }
          this.toastService.showToast('Roon-Einstellungen gespeichert!', 'success');
        },
        error: () => {
          this.isSavingRoon.set(false);
          this.toastService.showToast('Fehler beim Speichern der Roon-Einstellungen', 'error');
        },
      });
  }

  onThemeChange(newTheme: Theme): void {
    this.themeService.setTheme(newTheme);
  }

  onLanguageChange(newLang: Language): void {
    this.languageService.setLanguage(newLang);
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

