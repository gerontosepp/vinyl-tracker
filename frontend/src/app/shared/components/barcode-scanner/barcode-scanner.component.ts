import { Component, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { ScanResult, DiscogsMatch, SyncResult } from '../../../core/types';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col items-center p-4 h-full">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Scan Vinyl Barcode</h2>

      @if (isScanning()) {
        <div
          id="reader"
          class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl overflow-hidden [&_*]:dark:text-gray-200 shadow-sm"
        ></div>

        <!-- Manual Barcode Input Section on Scan Page -->
        <div class="w-full max-w-md mt-6 pt-5 border-t border-gray-200 dark:border-gray-700/80">
          <label class="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Oder Barcode-Nummer manuell eingeben:
          </label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                </svg>
              </span>
              <input
                type="text"
                [ngModel]="manualQuery()"
                (ngModelChange)="manualQuery.set($event)"
                (keyup.enter)="searchManual()"
                placeholder="z. B. 075678645624"
                class="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm"
              />
            </div>
            <button
              (click)="searchManual()"
              [disabled]="isSearchingManual() || !manualQuery().trim()"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors shadow-sm cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              @if (isSearchingManual()) {
                <span class="animate-spin text-xs">⏳</span>
                <span>Suchen...</span>
              } @else {
                <span>Code prüfen</span>
              }
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Ziffern unter dem Strichcode auf dem Plattencover eingeben.
          </p>
        </div>
      }

      @if (scanResult(); as result) {
        @if (result.success) {
          <!-- Success Case: Already in collection and listen logged -->
          <div
            class="mt-4 p-4 rounded-xl shadow-sm w-full max-w-md border bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/50"
          >
            <h3 class="font-bold flex items-center gap-2">
              <span>🎵</span> Jetzt aufgelegt!
            </h3>
            <p class="text-sm mt-1">{{ result.message }}</p>
            @if (result.record; as record) {
              <div class="mt-4 text-center">
                <img
                  [src]="apiService.getProxiedImageUrl(record.thumbUrl)"
                  alt="Cover"
                  class="w-32 h-32 mx-auto rounded-lg shadow-md object-cover"
                />
                <p class="font-semibold text-gray-900 dark:text-gray-100 mt-3">
                  {{ record.title }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ record.artist }}</p>
              </div>
            }
            <button
              (click)="handleReset()"
              class="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Nächste Platte scannen
            </button>
          </div>
        } @else if (result.discogsMatches && result.discogsMatches.length > 0) {
          <!-- Not in collection, but found on Discogs! -->
          <div
            class="mt-4 p-5 rounded-xl shadow-md w-full max-w-md border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-amber-200 dark:border-amber-700/50"
          >
            <!-- Header Badge -->
            <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold mb-3">
              <span class="text-lg">🔍</span>
              <span>Nicht in Sammlung – auf Discogs gefunden</span>
            </div>

            @if (addSuccessMessage(); as successMsg) {
              <!-- Added Successfully Notification -->
              <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 mb-4">
                <div class="font-semibold flex items-center gap-2">
                  <span>✅</span> Erfolgreich hinzugefügt!
                </div>
                <p class="text-xs mt-1">{{ successMsg }}</p>
              </div>
            } @else {
              <!-- Pressings list if multiple -->
              @if (result.discogsMatches.length > 1) {
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Mehrere Pressungen für diesen Barcode gefunden. Wähle deine Version:
                </p>
                <div class="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                  @for (match of result.discogsMatches; track match.id) {
                    <div
                      (click)="selectedMatchId.set(match.id)"
                      [class]="
                        'p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-3 ' +
                        (selectedMatchId() === match.id
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')
                      "
                    >
                      <img
                        [src]="apiService.getProxiedImageUrl(match.thumbUrl || match.coverImage || '')"
                        alt="Thumb"
                        class="w-12 h-12 rounded object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-700"
                      />
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate">{{ match.title }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          {{ match.year || 'Jahr unbekannt' }} • {{ match.country || 'Land n/a' }}
                        </p>
                        @if (match.format && match.format.length > 0) {
                          <span class="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {{ match.format.join(', ') }}
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Selected Match Details -->
              @if (getSelectedMatch(result.discogsMatches); as selected) {
                <div class="text-center my-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                  <img
                    [src]="apiService.getProxiedImageUrl(selected.coverImage || selected.thumbUrl || '')"
                    alt="Cover"
                    class="w-36 h-36 mx-auto rounded-lg shadow-md object-cover"
                  />
                  <h4 class="font-bold text-gray-900 dark:text-gray-100 mt-3 text-base">
                    {{ selected.title }}
                  </h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {{ selected.year || 'Unbekanntes Jahr' }} • {{ selected.country || 'International' }}
                  </p>
                  @if (selected.format && selected.format.length > 0) {
                    <div class="flex flex-wrap justify-center gap-1 mt-2">
                      @for (fmt of selected.format; track fmt) {
                        <span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                          {{ fmt }}
                        </span>
                      }
                    </div>
                  }
                </div>

                @if (addErrorMessage(); as errorMsg) {
                  <div class="p-2.5 mb-3 rounded text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    {{ errorMsg }}
                  </div>
                }

                <!-- Add to Discogs Button -->
                <button
                  (click)="addToDiscogs(selected.id)"
                  [disabled]="isAddingToCollection()"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg shadow transition-colors cursor-pointer"
                >
                  @if (isAddingToCollection()) {
                    <span class="animate-spin text-sm">⏳</span>
                    <span>Wird zu Discogs hinzugefügt...</span>
                  } @else {
                    <span>➕</span>
                    <span>Zu Discogs hinzufügen & synchronisieren</span>
                  }
                </button>
              }
            }

            <button
              (click)="handleReset()"
              class="mt-3 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Abbrechen / Neu scannen
            </button>
          </div>
        } @else {
          <!-- Error / Not found anywhere -->
          <div
            class="mt-4 p-5 rounded-xl shadow-sm w-full max-w-md border bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50"
          >
            <h3 class="font-bold flex items-center gap-2">
              <span>⚠️</span> Nicht gefunden
            </h3>
            <p class="text-sm mt-1">{{ result.message }}</p>

            <!-- Manual barcode / title fallback search -->
            <div class="mt-4 pt-3 border-t border-red-200 dark:border-red-800/60 text-left">
              <label class="block text-xs font-semibold text-red-900 dark:text-red-200 mb-1.5">
                Code korrigieren oder Album manuell suchen:
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  [ngModel]="manualQuery()"
                  (ngModelChange)="manualQuery.set($event)"
                  (keyup.enter)="searchManual()"
                  placeholder="Barcode oder Album/Künstler eingeben"
                  class="flex-1 px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  (click)="searchManual()"
                  [disabled]="isSearchingManual() || !manualQuery().trim()"
                  class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shrink-0"
                >
                  @if (isSearchingManual()) {
                    ⏳
                  } @else {
                    Suchen
                  }
                </button>
              </div>
            </div>

            <button
              (click)="handleReset()"
              class="mt-4 w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer text-sm font-medium transition-colors"
            >
              Erneut scannen
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);
  readonly scannerService = inject(ScannerService);

  readonly scanResult = signal<ScanResult | null>(null);
  readonly isScanning = signal<boolean>(true);
  readonly isAddingToCollection = signal<boolean>(false);
  readonly selectedMatchId = signal<number | null>(null);
  readonly addSuccessMessage = signal<string | null>(null);
  readonly addErrorMessage = signal<string | null>(null);
  readonly manualQuery = signal<string>('');
  readonly isSearchingManual = signal<boolean>(false);

  private scanner: Html5QrcodeScanner | null = null;
  private timerId: any = null;

  ngAfterViewInit(): void {
    this.timerId = setTimeout(() => this.startScanner(), 100);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
    this.cleanupScanner();
  }

  private async startScanner(): Promise<void> {
    const isSecure = window.isSecureContext;
    if (!isSecure) {
      this.scanResult.set({
        success: false,
        message: 'Camera access requires HTTPS or localhost.',
      });
      return;
    }

    this.cleanupScanner();

    // Clear DOM container
    const readerElement = document.getElementById('reader');
    if (readerElement) {
      readerElement.innerHTML = '';
    }

    const scannerInstance = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    this.scanner = scannerInstance;

    try {
      scannerInstance.render(
        async (result) => {
          console.log('Scanned:', result);
          this.cleanupScanner();
          this.isScanning.set(false);
          await this.executeBarcodeScan(result);
        },
        (_error) => {
          // Scanning...
        }
      );
    } catch (err) {
      console.error('Failed to render scanner', err);
    }
  }

  async executeBarcodeScan(barcode: string): Promise<void> {
    const user = this.authService.user();
    if (!user) return;

    this.manualQuery.set(barcode);
    this.isSearchingManual.set(true);

    try {
      const apiResult: ScanResult = await firstValueFrom(
        this.apiService.scanBarcode(barcode)
      );
      this.handleScanResponse(apiResult);
    } catch (error: any) {
      const errorResult = error?.error;
      if (
        errorResult &&
        typeof errorResult === 'object' &&
        ('discogsMatches' in errorResult || 'message' in errorResult)
      ) {
        this.handleScanResponse(errorResult);
      } else {
        const msg =
          errorResult?.message || error?.message || 'Netzwerkfehler oder Serverfehler';
        this.scanResult.set({ success: false, message: msg });
      }
    } finally {
      this.isSearchingManual.set(false);
    }
  }

  private handleScanResponse(apiResult: ScanResult): void {
    this.scanResult.set(apiResult);
    if (apiResult.success) {
      this.scannerService.notifyScanLogged();
    }
    if (apiResult.discogsMatches && apiResult.discogsMatches.length > 0) {
      this.selectedMatchId.set(apiResult.discogsMatches[0].id);
    }
  }

  searchManual(): void {
    const q = this.manualQuery().trim();
    if (!q) return;
    this.cleanupScanner();
    this.isScanning.set(false);
    this.executeBarcodeScan(q);
  }

  private cleanupScanner(): void {
    if (this.scanner) {
      try {
        this.scanner.clear();
      } catch (err) {
        // ignore errors
      }
      this.scanner = null;
    }
  }

  getSelectedMatch(matches: DiscogsMatch[]): DiscogsMatch | null {
    if (!matches || matches.length === 0) return null;
    const currentId = this.selectedMatchId();
    if (currentId !== null) {
      const found = matches.find((m) => m.id === currentId);
      if (found) return found;
    }
    return matches[0];
  }

  async addToDiscogs(releaseId: number): Promise<void> {
    this.isAddingToCollection.set(true);
    this.addErrorMessage.set(null);
    try {
      const syncResult: SyncResult = await firstValueFrom(
        this.apiService.addReleaseToCollection(releaseId)
      );
      this.addSuccessMessage.set(
        `Platte erfolgreich zu Discogs hinzugefügt und synchronisiert! (${syncResult.added} neu synchronisiert)`
      );
      this.toastService.showToast(
        'Erfolgreich zu deiner Discogs-Sammlung hinzugefügt!',
        'success'
      );
      this.scannerService.notifyScanLogged();
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        err?.error?.detail ||
        err?.message ||
        'Fehler beim Hinzufügen zu Discogs.';
      this.addErrorMessage.set(msg);
      this.toastService.showToast(msg, 'error');
    } finally {
      this.isAddingToCollection.set(false);
    }
  }

  handleReset(): void {
    this.scanResult.set(null);
    this.selectedMatchId.set(null);
    this.addSuccessMessage.set(null);
    this.addErrorMessage.set(null);
    this.manualQuery.set('');
    this.isSearchingManual.set(false);
    this.isScanning.set(true);
    setTimeout(() => this.startScanner(), 100);
  }
}
