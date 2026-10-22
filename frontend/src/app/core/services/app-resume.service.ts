import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/** Time in the background after which shown data may be outdated (changed on another device). */
export const STALE_AFTER_MS = 30_000;

/**
 * Notifies pages when the app returns to the foreground after it was hidden for at least
 * {@link STALE_AFTER_MS}, so they reload data that may have changed elsewhere in the meantime.
 */
@Injectable({ providedIn: 'root' })
export class AppResumeService {
  private readonly document = inject(DOCUMENT);
  private readonly resumedSubject = new Subject<void>();
  private hiddenAt: number | null = null;

  readonly resumed$: Observable<void> = this.resumedSubject.asObservable();

  constructor() {
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
      } else if (this.hiddenAt !== null) {
        const away = Date.now() - this.hiddenAt;
        this.hiddenAt = null;
        if (away >= STALE_AFTER_MS) this.resumedSubject.next();
      }
    });
  }
}
