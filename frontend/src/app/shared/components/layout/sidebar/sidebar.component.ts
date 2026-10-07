import { Component, output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ScannerService } from '../../../../core/services/scanner.service';
import {
  LucideHome,
  LucideDisc,
  LucideUser,
  LucideSettings,
  LucideScanLine,
  LucideBarChart2,
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    LucideHome,
    LucideDisc,
    LucideUser,
    LucideSettings,
    LucideScanLine,
    LucideBarChart2,
  ],
  template: `
    <aside
      class="hidden md:flex flex-col w-24 h-[calc(100vh-4rem)] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl fixed left-0 top-16 border-r border-slate-200/50 dark:border-slate-700 z-20 items-center py-6 transition-colors shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]"
    >
      <nav class="flex-1 flex flex-col gap-4 w-full">
        <!-- Home -->
        <a
          routerLink="/"
          (click)="scannerService.closeScanner()"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive
          #rlaHome="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 cursor-pointer ' +
            (rlaHome.isActive && !scannerService.showScanner()
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium')
          "
        >
          <svg lucideHome [size]="26" [strokeWidth]="rlaHome.isActive && !scannerService.showScanner() ? 2.5 : 2"></svg>
          <span class="mt-1.5 text-xs tracking-wide">{{ 'nav.home' | translate }}</span>
        </a>

        <!-- Collection -->
        <a
          routerLink="/collection"
          (click)="scannerService.closeScanner()"
          routerLinkActive
          #rlaCol="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 cursor-pointer ' +
            (rlaCol.isActive
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium')
          "
        >
          <svg lucideDisc [size]="26" [strokeWidth]="rlaCol.isActive ? 2.5 : 2"></svg>
          <span class="mt-1.5 text-xs tracking-wide">{{ 'nav.collection' | translate }}</span>
        </a>

        <!-- Stats -->
        <a
          routerLink="/statistics"
          (click)="scannerService.closeScanner()"
          routerLinkActive
          #rlaStats="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 cursor-pointer ' +
            (rlaStats.isActive
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium')
          "
        >
          <svg lucideBarChart2 [size]="26" [strokeWidth]="rlaStats.isActive ? 2.5 : 2"></svg>
          <span class="mt-1.5 text-xs tracking-wide">{{ 'nav.stats' | translate }}</span>
        </a>

        <!-- Profile -->
        <a
          routerLink="/profile"
          (click)="scannerService.closeScanner()"
          routerLinkActive
          #rlaProfile="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 cursor-pointer ' +
            (rlaProfile.isActive
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium')
          "
        >
          <svg lucideUser [size]="26" [strokeWidth]="rlaProfile.isActive ? 2.5 : 2"></svg>
          <span class="mt-1.5 text-xs tracking-wide">{{ 'nav.profile' | translate }}</span>
        </a>

        <!-- Scan Button -->
        <div class="px-3 mt-4 w-full">
          <button
            (click)="scanClick.emit()"
            [class]="
              'flex flex-col items-center justify-center py-3.5 w-full rounded-2xl transition-all duration-300 group cursor-pointer ' +
              (scannerService.showScanner()
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-[0_8px_20px_-4px_rgba(79,70,229,0.7)] scale-105'
                : 'bg-indigo-500 text-white shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] hover:bg-indigo-600 hover:-translate-y-1')
            "
            [attr.aria-label]="'nav.scan' | translate"
          >
            <svg lucideScanLine [size]="24" class="group-hover:scale-110 transition-transform"></svg>
            <span class="mt-1.5 text-xs font-bold tracking-wide">{{ 'nav.scan' | translate }}</span>
          </button>
        </div>
      </nav>

      <!-- Settings -->
      <button
        routerLink="/settings"
        (click)="scannerService.closeScanner()"
        routerLinkActive
        #rlaSettings="routerLinkActive"
        [attr.aria-label]="'nav.settings' | translate"
        [class]="
          'p-4 transition-colors rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 mb-2 cursor-pointer ' +
          (rlaSettings.isActive
            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideSettings [size]="24"></svg>
      </button>
    </aside>
  `,
})
export class SidebarComponent {
  readonly scanClick = output<void>();
  readonly scannerService = inject(ScannerService);
}


