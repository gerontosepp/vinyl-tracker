import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ScannerService } from '../../../../core/services/scanner.service';
import {
  LucideHome,
  LucideDisc,
  LucideUser,
  LucideScanLine,
} from '@lucide/angular';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    LucideHome,
    LucideDisc,
    LucideUser,
    LucideScanLine,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700 flex justify-around items-center px-2 py-2 z-50 h-[80px] pb-safe transition-colors shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
    >
      <!-- Home -->
      <a
        routerLink="/"
        (click)="scannerService.closeScanner()"
        [routerLinkActiveOptions]="{ exact: true }"
        routerLinkActive
        #rlaHome="routerLinkActive"
        [attr.aria-label]="'nav.home' | translate"
        [class]="itemClass(rlaHome.isActive && !scannerService.showScanner())"
      >
        <svg lucideHome [size]="28" [strokeWidth]="rlaHome.isActive && !scannerService.showScanner() ? 2.5 : 2"></svg>
      </a>

      <!-- Collection -->
      <a
        routerLink="/collection"
        (click)="scannerService.closeScanner()"
        routerLinkActive
        #rlaCol="routerLinkActive"
        [attr.aria-label]="'nav.collection' | translate"
        [class]="itemClass(rlaCol.isActive && !scannerService.showScanner())"
      >
        <svg lucideDisc [size]="28" [strokeWidth]="rlaCol.isActive && !scannerService.showScanner() ? 2.5 : 2"></svg>
      </a>

      <!-- Scan -->
      <button
        type="button"
        data-testid="nav-scan"
        (click)="scanClick.emit()"
        [attr.aria-label]="'nav.scan' | translate"
        [class]="itemClass(scannerService.showScanner())"
      >
        <svg lucideScanLine [size]="28" [strokeWidth]="scannerService.showScanner() ? 2.5 : 2"></svg>
      </button>

      <!-- Sort mode (Kallax shelf) -->
      <a
        routerLink="/sort"
        data-testid="nav-sort"
        (click)="scannerService.closeScanner()"
        [attr.aria-label]="'nav.sort' | translate"
        [class]="itemClass(false)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <path d="M12 3v18M3 12h18" />
          <path d="M6 6.5v3M9 6.5v3M15 15.5l0 3M18 15.5l-1.5 3" stroke-width="1.5" />
        </svg>
      </a>

      <!-- Profile -->
      <a
        routerLink="/profile"
        (click)="scannerService.closeScanner()"
        routerLinkActive
        #rlaProfile="routerLinkActive"
        [attr.aria-label]="'nav.profile' | translate"
        [class]="itemClass(rlaProfile.isActive && !scannerService.showScanner())"
      >
        <svg lucideUser [size]="28" [strokeWidth]="rlaProfile.isActive && !scannerService.showScanner() ? 2.5 : 2"></svg>
      </a>
    </nav>
  `,
})
export class BottomNavComponent {
  readonly scanClick = output<void>();
  readonly scannerService = inject(ScannerService);

  itemClass(active: boolean): string {
    return (
      'p-3 transition-all duration-200 cursor-pointer ' +
      (active
        ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm font-bold'
        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
    );
  }
}


