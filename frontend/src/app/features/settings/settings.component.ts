import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { LanguageService, Language } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { ScannerService } from '../../core/services/scanner.service';
import { getErrorMessage } from '../../core/utils/error';
import { RoonStatus } from '../../core/types';
import { LucideDownload, LucideLogOut, LucideSettings, LucideHistory, LucideUpload, LucidePrinter } from '@lucide/angular';
import { PrintDialogComponent } from '../../shared/components/print-dialog/print-dialog.component';
import { ReleaseNotesComponent } from './components/release-notes/release-notes.component';
import { APP_VERSION } from '../../core/constants/release-info.data';

interface PendingRestore {
  fileName: string;
  count: number;
  backup: unknown;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    FormsModule,
    LayoutComponent,
    TranslatePipe,
    LucideDownload,
    LucideLogOut,
    LucideSettings,
    LucideHistory,
    LucideUpload,
    LucidePrinter,
    PrintDialogComponent,
    ReleaseNotesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-layout>
      <div class="max-w-6xl mx-auto space-y-6">
        <!-- HEADER & TAB NAVIGATION -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 px-2">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {{ 'settings.title' | translate }}
          </h1>

          <!-- Segmented Tab Navigation -->
          <div
            class="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs self-start sm:self-auto"
          >
            <button
              type="button"
              (click)="activeTab.set('settings')"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none"
              [class.bg-white]="activeTab() === 'settings'"
              [class.dark:bg-slate-700]="activeTab() === 'settings'"
              [class.text-indigo-600]="activeTab() === 'settings'"
              [class.dark:text-indigo-400]="activeTab() === 'settings'"
              [class.shadow-xs]="activeTab() === 'settings'"
              [class.text-slate-600]="activeTab() !== 'settings'"
              [class.dark:text-slate-400]="activeTab() !== 'settings'"
            >
              <svg lucideSettings [size]="16"></svg>
              {{ 'settings.tabSettings' | translate }}
            </button>

            <button
              type="button"
              (click)="activeTab.set('changes')"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none"
              [class.bg-white]="activeTab() === 'changes'"
              [class.dark:bg-slate-700]="activeTab() === 'changes'"
              [class.text-indigo-600]="activeTab() === 'changes'"
              [class.dark:text-indigo-400]="activeTab() === 'changes'"
              [class.shadow-xs]="activeTab() === 'changes'"
              [class.text-slate-600]="activeTab() !== 'changes'"
              [class.dark:text-slate-400]="activeTab() !== 'changes'"
            >
              <svg lucideHistory [size]="16"></svg>
              {{ 'settings.tabChanges' | translate }}
              <span
                class="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
              >
                v{{ appVersion }}
              </span>
            </button>
          </div>
        </div>

        <!-- TAB 1: EINSTELLUNGEN -->
        @if (activeTab() === 'settings') {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
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
                    class="w-full py-2.5 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg lucideLogOut [size]="16"></svg>
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
              </div>

              <!-- Export Collection Options -->
              <div class="border-t border-slate-100 dark:border-slate-700/50 pt-5">
                <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {{ 'settings.exportTitle' | translate }}
                </h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {{ 'settings.exportDesc' | translate }}
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    (click)="handleExportCollection('csv')"
                    [disabled]="isExporting() !== null"
                    class="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl transition-all shadow-xs hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <svg lucideDownload [size]="16" class="text-slate-400 dark:text-slate-500"></svg>
                    <span>{{ (isExporting() === 'csv' ? 'settings.exporting' : 'settings.exportCsv') | translate }}</span>
                  </button>

                  <button
                    type="button"
                    (click)="handleExportCollection('json')"
                    [disabled]="isExporting() !== null"
                    class="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl transition-all shadow-xs hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <svg lucideDownload [size]="16" class="text-slate-400 dark:text-slate-500"></svg>
                    <span>{{ (isExporting() === 'json' ? 'settings.exporting' : 'settings.exportJson') | translate }}</span>
                  </button>

                  <button
                    type="button"
                    (click)="handleExportCollection('pdf')"
                    [disabled]="isExporting() !== null"
                    class="bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 font-bold px-4 py-3 rounded-xl transition-all shadow-xs hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <svg lucideDownload [size]="16" class="text-indigo-500"></svg>
                    <span>{{ (isExporting() === 'pdf' ? 'settings.exporting' : 'settings.exportPdf') | translate }}</span>
                  </button>
                </div>
              </div>

              <!-- Restore Collection from JSON Backup -->
              <div class="border-t border-slate-100 dark:border-slate-700/50 pt-5 mt-5">
                <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {{ 'settings.restoreTitle' | translate }}
                </h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  {{ 'settings.restoreDesc' | translate }}
                </p>

                <input
                  #restoreInput
                  type="file"
                  accept=".json,application/json"
                  class="hidden"
                  data-testid="restore-file-input"
                  (change)="handleRestoreFileSelected($event)"
                />
                <button
                  type="button"
                  (click)="restoreInput.click()"
                  [disabled]="isRestoring()"
                  data-testid="restore-button"
                  class="w-full sm:w-auto bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold px-4 py-3 rounded-xl transition-all shadow-xs hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg lucideUpload [size]="16" class="text-slate-400 dark:text-slate-500"></svg>
                  <span>{{ (isRestoring() ? 'settings.restoring' : 'settings.restoreButton') | translate }}</span>
                </button>
              </div>
            </div>

            <!-- QR-Code Management -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors"
            >
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                {{ 'settings.qrManagementTitle' | translate }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
                {{ 'settings.qrManagementDesc' | translate }}
              </p>

              <div>
                <button
                  (click)="showPrintDialog.set(true)"
                  data-testid="open-print-dialog"
                  class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <svg lucidePrinter [size]="18"></svg>
                  {{ 'settings.downloadQr' | translate }}
                </button>
              </div>
            </div>

            <!-- Barcode & QR Scanner Settings -->
            <div
              class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors space-y-6"
            >
              <div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {{ 'settings.scannerTitle' | translate }}
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {{ 'settings.scannerDesc' | translate }}
                </p>
              </div>

              <!-- Scanner Mode Selection -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {{ 'settings.scannerMode' | translate }}
                </label>
                <select
                  [ngModel]="scannerService.scannerMode()"
                  (ngModelChange)="scannerService.setScannerMode($event)"
                  class="w-full border border-slate-200 dark:border-slate-600 rounded-xl py-2.5 px-4 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 shadow-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all cursor-pointer"
                >
                  <option value="hardware">🎯 {{ 'settings.scannerModeHardware' | translate }}</option>
                  <option value="camera">📷 {{ 'settings.scannerModeCamera' | translate }}</option>
                  <option value="hybrid">⚡ {{ 'settings.scannerModeHybrid' | translate }}</option>
                </select>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                  {{ 'settings.scannerModeDesc' | translate }}
                </p>
              </div>

              <!-- Sound Feedback Toggle -->
              <div class="border-t border-slate-100 dark:border-slate-700/50 pt-4 flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-slate-700 dark:text-slate-300">
                    {{ 'settings.scannerSound' | translate }}
                  </h4>
                  <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {{ 'settings.scannerSoundDesc' | translate }}
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="scannerService.soundFeedback()"
                    (change)="scannerService.setSoundFeedback(!scannerService.soundFeedback())"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <!-- Live Scanner Test -->
              <div class="border-t border-slate-100 dark:border-slate-700/50 pt-4 space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="font-semibold text-slate-700 dark:text-slate-300">
                    {{ 'settings.scannerTestTitle' | translate }}
                  </h4>
                  @if (scannerService.lastScannedCode()) {
                    <button
                      (click)="scannerService.clearLastScannedCode()"
                      class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold"
                    >
                      {{ 'settings.scannerResetTest' | translate }}
                    </button>
                  }
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {{ 'settings.scannerTestDesc' | translate }}
                </p>

                @if (scannerService.lastScannedCode(); as lastCode) {
                  <!-- Scanned Code Display Box -->
                  <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800/40 px-2 py-0.5 rounded-full">
                          <span>✅</span> {{ 'settings.scannerTestSuccess' | translate }}
                        </span>
                        <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {{ lastCode.type === '1d' ? ('settings.scannerType1D' | translate) : ('settings.scannerType2D' | translate) }}
                        </span>
                      </div>
                      <div class="mt-1 font-mono font-bold text-slate-900 dark:text-slate-100 text-base break-all">
                        {{ lastCode.code }}
                      </div>
                    </div>
                    <button
                      (click)="scannerService.playBeep()"
                      class="text-xs px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold cursor-pointer shrink-0"
                    >
                      🔊 Test-Beep
                    </button>
                  </div>
                } @else {
                  <!-- Waiting for scan box -->
                  <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                    <span class="text-xs font-medium">
                      {{ 'settings.scannerTestWaiting' | translate }}
                    </span>
                  </div>
                }
              </div>
            </div>

            </div>
          </div>
        }

        <!-- TAB 2: VERSIONS-HINWEISE / CHANGES -->
        @if (activeTab() === 'changes') {
          <div class="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <app-release-notes />
          </div>
        }
      </div>

      <!-- Confirm Dialog for Reset Listens -->
      @if (showPrintDialog()) {
        <app-print-dialog (closed)="showPrintDialog.set(false)" />
      }

      @if (pendingRestore(); as restore) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-600 p-8 max-w-md animate-fade-in"
            data-testid="restore-confirm"
          >
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {{ 'settings.restoreConfirmTitle' | translate }}
            </h3>
            <p class="text-slate-600 dark:text-slate-400 text-sm mb-6">
              {{ 'settings.restoreConfirmText' | translate: { file: restore.fileName, count: restore.count } }}
            </p>
            <div class="flex gap-3">
              <button
                (click)="pendingRestore.set(null)"
                class="flex-1 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {{ 'settings.cancel' | translate }}
              </button>
              <button
                (click)="confirmRestore()"
                class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                {{ 'settings.restoreConfirm' | translate }}
              </button>
            </div>
          </div>
        </div>
      }

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
  readonly scannerService = inject(ScannerService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly appVersion = APP_VERSION;

  discogsUsername = this.authService.user()?.discogsUsername || '';
  token = '';
  password = '';
  readonly showResetConfirm = signal<boolean>(false);
  readonly activeTab = signal<'settings' | 'changes'>('settings');

  // Roon Integration
  roonHost = this.authService.user()?.roonHost || '';
  roonPort = this.authService.user()?.roonPort || 9330;
  roonZoneId = this.authService.user()?.roonZoneId || '';
  readonly roonStatus = signal<RoonStatus | null>(null);
  readonly isSavingRoon = signal<boolean>(false);
  readonly isLoadingZones = signal<boolean>(false);
  readonly showPrintDialog = signal<boolean>(false);
  readonly isExporting = signal<'csv' | 'json' | 'pdf' | null>(null);
  readonly isRestoring = signal<boolean>(false);
  readonly pendingRestore = signal<PendingRestore | null>(null);

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

  async handleExportCollection(format: 'csv' | 'json' | 'pdf'): Promise<void> {
    const user = this.authService.user();
    if (!user) return;

    this.isExporting.set(format);
    try {
      const blob = await firstValueFrom(this.apiService.exportCollection(format));
      const extension = format === 'pdf' ? 'pdf' : (format === 'json' ? 'json' : 'csv');
      const filename = `vinyl_collection_${format === 'pdf' ? 'catalog' : (format === 'json' ? 'backup' : 'export')}.${extension}`;
      this.downloadBlob(blob, filename);
      this.toastService.showToast(this.languageService.translate('settings.exportSuccess'), 'success');
    } catch (err) {
      console.error(err);
      this.toastService.showToast(getErrorMessage(err, this.languageService.translate('settings.exportError')), 'error');
    } finally {
      this.isExporting.set(null);
    }
  }

  async handleRestoreFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so selecting the same file again triggers another change event
    input.value = '';
    if (!file) return;

    let backup: unknown;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      backup = null;
    }
    const releases = (backup as { releases?: unknown } | null)?.releases;
    if (!Array.isArray(releases)) {
      this.toastService.showToast(this.languageService.translate('settings.restoreInvalid'), 'error');
      return;
    }

    this.pendingRestore.set({ fileName: file.name, count: releases.length, backup });
  }

  async confirmRestore(): Promise<void> {
    const pending = this.pendingRestore();
    if (!pending) return;
    this.pendingRestore.set(null);

    this.isRestoring.set(true);
    try {
      const result = await firstValueFrom(this.apiService.restoreCollection(pending.backup));
      this.toastService.showToast(
        this.languageService.translate('settings.restoreSuccess', {
          records: result.records_total,
          added: result.records_added,
          listens: result.listens_added,
        }),
        'success'
      );
      if (!result.listen_history_included) {
        this.toastService.showToast(this.languageService.translate('settings.restoreNoHistory'), 'info');
      }
    } catch (err) {
      console.error(err);
      this.toastService.showToast(getErrorMessage(err, this.languageService.translate('settings.restoreError')), 'error');
    } finally {
      this.isRestoring.set(false);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

