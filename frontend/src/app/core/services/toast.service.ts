import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  showToast(message: string, type: ToastType = 'info'): void {
    const id = Math.random().toString(36).substring(2, 9);
    this.toasts.update((prev) => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(id);
    }, 5000);
  }

  removeToast(id: string): void {
    this.toasts.update((prev) => prev.filter((toast) => toast.id !== id));
  }
}
