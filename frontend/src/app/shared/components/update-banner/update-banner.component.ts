import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideRefreshCw, LucideX } from '@lucide/angular';
import { AppUpdateService } from '../../../core/services/app-update.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [LucideRefreshCw, LucideX, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (update.updateReady()) {
      <div
        role="status"
        class="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md flex items-center gap-3 p-3 rounded-xl border shadow-lg border-blue-100 bg-blue-50 dark:bg-blue-900/40 dark:border-blue-800"
      >
        <svg lucideRefreshCw class="flex-shrink-0 text-blue-500" [size]="20"></svg>
        <span class="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
          {{ 'update.available' | translate }}
        </span>
        <button
          type="button"
          data-testid="update-reload"
          (click)="update.reload()"
          class="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
        >
          {{ 'update.reload' | translate }}
        </button>
        <button
          type="button"
          data-testid="update-dismiss"
          [attr.aria-label]="'update.dismiss' | translate"
          (click)="update.dismiss()"
          class="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
        >
          <svg lucideX [size]="18"></svg>
        </button>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  readonly update = inject(AppUpdateService);
}
