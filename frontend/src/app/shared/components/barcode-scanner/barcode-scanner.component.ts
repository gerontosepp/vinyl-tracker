import { Component, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ScanResult } from '../../../core/types';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  template: `
    <div class="flex flex-col items-center p-4 h-full">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Scan Vinyl Barcode</h2>

      @if (isScanning()) {
        <div
          id="reader"
          class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl overflow-hidden [&_*]:dark:text-gray-200"
        ></div>
      }

      @if (scanResult(); as result) {
        <div
          [class]="
            'mt-4 p-4 rounded-xl shadow-sm w-full max-w-md border ' +
            (result.success
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/50'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50')
          "
        >
          <h3 class="font-bold">{{ result.success ? 'Success!' : 'Error' }}</h3>
          <p>{{ result.message }}</p>
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
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
          >
            Scan Next
          </button>
        </div>
      }
    </div>
  `,
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);

  readonly scanResult = signal<ScanResult | null>(null);
  readonly isScanning = signal<boolean>(true);

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

          const user = this.authService.user();
          if (user) {
            try {
              const apiResult = await firstValueFrom(
                this.apiService.scanBarcode(result)
              );
              this.scanResult.set(apiResult);
            } catch (error) {
              const msg =
                typeof error === 'object' &&
                error !== null &&
                'error' in error &&
                typeof (error as { error?: { message?: string } }).error?.message === 'string'
                  ? (error as { error?: { message?: string } }).error?.message
                  : 'Network error or backend failure';
              this.scanResult.set({ success: false, message: msg || 'Scan failed' });
            }
          }
        },
        (_error) => {
          // Scanning...
        }
      );
    } catch (err) {
      console.error('Failed to render scanner', err);
    }
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

  handleReset(): void {
    this.scanResult.set(null);
    this.isScanning.set(true);
    setTimeout(() => this.startScanner(), 100);
  }
}
