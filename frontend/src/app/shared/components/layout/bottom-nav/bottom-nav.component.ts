import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
        [routerLinkActiveOptions]="{ exact: true }"
        routerLinkActive
        #rlaHome="routerLinkActive"
        [class]="
          'p-4 transition-all duration-200 ' +
          (rlaHome.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideHome [size]="28" [strokeWidth]="rlaHome.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Collection -->
      <a
        routerLink="/collection"
        routerLinkActive
        #rlaCol="routerLinkActive"
        [class]="
          'p-4 transition-all duration-200 ' +
          (rlaCol.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideDisc [size]="28" [strokeWidth]="rlaCol.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Floating Scan Button -->
      <div class="relative -top-6">
        <button
          (click)="scanClick.emit()"
          aria-label="Scan Record"
          class="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-4 shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] flex items-center justify-center transition-transform hover:-translate-y-1 active:scale-95 w-16 h-16 border-4 border-slate-50 dark:border-slate-900 cursor-pointer"
        >
          <svg lucideScanLine [size]="30" strokeWidth="2.5"></svg>
        </button>
      </div>

      <!-- Stats -->
      <a
        routerLink="/statistics"
        routerLinkActive
        #rlaStats="routerLinkActive"
        [class]="
          'p-4 transition-all duration-200 ' +
          (rlaStats.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm'
            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
        "
      >
        <svg lucideBarChart2 [size]="28" [strokeWidth]="rlaStats.isActive ? 2.5 : 2"></svg>
      </a>

      <!-- Profile -->
      <a
        routerLink="/profile"
        routerLinkActive
        #rlaProfile="routerLinkActive"
        [class]="
          'p-4 transition-all duration-200 ' +
          (rlaProfile.isActive
            ? 'text-indigo-600 dark:text-indigo-400 scale-110 drop-shadow-sm'
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
}
