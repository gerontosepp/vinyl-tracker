import { Injectable, signal, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScannerService {
  readonly showScanner = signal<boolean>(false);
  private readonly router = inject(Router, { optional: true });

  constructor() {
    this.router?.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (event.url !== '/' && event.url !== '') {
          this.closeScanner();
        }
      });
  }

  readonly scanLogged = signal<number>(0);

  openScanner(): void {
    this.showScanner.set(true);
  }

  closeScanner(): void {
    this.showScanner.set(false);
  }

  toggleScanner(): void {
    this.showScanner.update((open) => !open);
  }

  notifyScanLogged(): void {
    this.scanLogged.update((n) => n + 1);
  }
}

