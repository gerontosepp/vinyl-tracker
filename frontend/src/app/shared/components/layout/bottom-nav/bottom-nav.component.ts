import { Component, output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ScannerService } from '../../../../core/services/scanner.service';
import {
  LucideHome,
  LucideDisc,
  LucideUser,
  LucideScanLine,
  LucideBarChart2,
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
    LucideBarChart2,
  ],
  template: `
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700 flex justify-between items-center px-6 py-2 z-50 h-[80px] pb-safe transition-colors shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]"
    >
      <!-- Home -->
      <a
        routerLink="/"
        (click)="scannerService.closeScanner()"
        [routerLinkActiveOptions]="{ exact: true }"
        routerLinkActive
        #rlaHome="routerLinkActive"
        [attr.aria-label]="'nav.home' | translate"
        [class]="
          'p-4 transition-all duration-200 cursor-pointer ' +
          (rlaHome.isActive && !scannerService.showScanner()
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm font-bold'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
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
        [class]="
          'p-4 transition-all duration-200 cursor-pointer ' +
          (rlaCol.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm font-bold'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideDisc [size]="28" [strokeWidth]="rlaCol.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Floating Scan Button -->
      <div class="relative -top-6">
        <button
          (click)="scanClick.emit()"
          [attr.aria-label]="'nav.scan' | translate"
          [class]="
            'rounded-full p-4 flex items-center justify-center transition-transform hover:-translate-y-1 active:scale-95 w-16 h-16 border-4 border-slate-50 dark:border-slate-900 cursor-pointer ' +
            (scannerService.showScanner()
              ? 'bg-indigo-600 ring-4 ring-indigo-400 text-white shadow-[0_8px_20px_-4px_rgba(79,70,229,0.7)]'
              : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)]')
          "
        >
          <svg lucideScanLine [size]="30" strokeWidth="2.5"></svg>
        </button>
      </div>

      <!-- Stats -->
      <a
        routerLink="/statistics"
        (click)="scannerService.closeScanner()"
        routerLinkActive
        #rlaStats="routerLinkActive"
        [attr.aria-label]="'nav.stats' | translate"
        [class]="
          'p-4 transition-all duration-200 cursor-pointer ' +
          (rlaStats.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm font-bold'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideBarChart2 [size]="28" [strokeWidth]="rlaStats.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Profile -->
      <a
        routerLink="/profile"
        (click)="scannerService.closeScanner()"
        routerLinkActive
        #rlaProfile="routerLinkActive"
        [attr.aria-label]="'nav.profile' | translate"
        [class]="
          'p-4 transition-all duration-200 cursor-pointer ' +
          (rlaProfile.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm font-bold'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideUser [size]="28" [strokeWidth]="rlaProfile.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Additional spacer to balance design -->
      <div class="w-8"></div>
    </nav>
  `,
})
export class BottomNavComponent {
  readonly scanClick = output<void>();
  readonly scannerService = inject(ScannerService);
}


