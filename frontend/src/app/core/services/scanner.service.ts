import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ScannerService {
  readonly showScanner = signal<boolean>(false);

  openScanner(): void {
    this.showScanner.set(true);
  }

  closeScanner(): void {
    this.showScanner.set(false);
  }
}
