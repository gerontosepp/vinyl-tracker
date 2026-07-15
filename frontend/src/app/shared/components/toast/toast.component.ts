import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import {
  LucideX,
  LucideCheckCircle,
  LucideAlertCircle,
  LucideInfo,
  LucideAlertTriangle,
} from '@lucide/angular';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [LucideX, LucideCheckCircle, LucideAlertCircle, LucideInfo, LucideAlertTriangle],
  template: `
    <div
      class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none min-w-[300px] max-w-[400px]"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [class]="
            'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-in-right ' +
            getColorClass(toast.type)
          "
        >
          <div class="flex-shrink-0 mt-0.5">
            @switch (toast.type) {
              @case ('success') {
                <svg lucideCheckCircle class="text-green-500" [size]="20"></svg>
              }
              @case ('error') {
                <svg lucideAlertCircle class="text-red-500" [size]="20"></svg>
              }
              @case ('info') {
                <svg lucideInfo class="text-blue-500" [size]="20"></svg>
              }
              @case ('warning') {
                <svg lucideAlertTriangle class="text-amber-500" [size]="20"></svg>
              }
            }
          </div>
          <div class="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {{ toast.message }}
          </div>
          <button
            (click)="toastService.removeToast(toast.id)"
            class="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <svg lucideX [size]="18"></svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  getColorClass(type: string): string {
    switch (type) {
      case 'success':
        return 'border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-800';
      case 'error':
        return 'border-red-100 bg-red-50 dark:bg-red-900/20 dark:border-red-800';
      case 'info':
        return 'border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800';
      case 'warning':
        return 'border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800';
      default:
        return 'border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800';
    }
  }
}
