import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { IMAGE_DOWNSCALER } from '../../../core/utils/image';
import { getErrorMessage } from '../../../core/utils/error';

/**
 * Takes a photo of a record label for records without barcode. The photo lands in the label
 * inbox and is identified later by Claude via the MCP prompt `process_label_inbox`.
 */
@Component({
  selector: 'app-label-photo-capture',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-md mt-5 pt-5 border-t border-gray-200 dark:border-gray-700/80">
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {{ 'scanner.labelPhotoTitle' | translate }}
        </span>
        @if (pendingCount() > 0) {
          <span
            class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
            data-testid="label-inbox-count"
          >
            {{ 'scanner.labelPhotoPending' | translate: { count: pendingCount() } }}
          </span>
        }
      </div>
      <input
        #fileInput
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        data-testid="label-photo-input"
        (change)="onFileSelected($event)"
      />
      <button
        type="button"
        (click)="fileInput.click()"
        [disabled]="isUploading()"
        class="w-full px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-900 dark:text-gray-100 font-medium rounded-lg text-sm border border-gray-300 dark:border-gray-600 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
      >
        @if (isUploading()) {
          <span class="animate-spin text-xs">⏳</span>
          <span>{{ 'scanner.labelPhotoUploading' | translate }}</span>
        } @else {
          <span aria-hidden="true">📷</span>
          <span>{{ 'scanner.labelPhotoButton' | translate }}</span>
        }
      </button>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
        {{ 'scanner.labelPhotoHint' | translate }}
      </p>
    </div>
  `,
})
export class LabelPhotoCaptureComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly downscale = inject(IMAGE_DOWNSCALER);

  readonly pendingCount = signal(0);
  readonly isUploading = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const inbox = await firstValueFrom(this.apiService.getLabelPhotos('pending', 1));
      this.pendingCount.set(inbox.pendingCount);
    } catch {
      // The badge is optional; the upload reports its own errors
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    try {
      const photo = await this.downscale(file);
      const result = await firstValueFrom(this.apiService.uploadLabelPhoto(photo));
      this.pendingCount.set(result.pendingCount);
      this.toastService.showToast(
        this.languageService.translate('scanner.labelPhotoSaved', { count: result.pendingCount }),
        'success'
      );
    } catch (error) {
      this.toastService.showToast(
        getErrorMessage(error, this.languageService.translate('scanner.labelPhotoError')),
        'error'
      );
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }
}
