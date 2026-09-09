import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
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
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive
          #rlaHome="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 ' +
            (rlaHome.isActive
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium')
          "
        >
          <svg lucideHome [size]="26" [strokeWidth]="rlaHome.isActive ? 2.5 : 2"></svg>
          <span class="mt-1.5 text-xs tracking-wide">{{ 'nav.home' | translate }}</span>
        </a>

        <!-- Collection -->
        <a
          routerLink="/collection"
          routerLinkActive
          #rlaCol="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 ' +
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
          routerLinkActive
          #rlaStats="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 ' +
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
          routerLinkActive
          #rlaProfile="routerLinkActive"
          [class]="
            'flex flex-col items-center justify-center py-4 px-2 w-[calc(100%-1rem)] rounded-2xl mx-2 transition-all duration-200 ' +
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
            class="flex flex-col items-center justify-center py-3.5 w-full bg-indigo-500 text-white rounded-2xl shadow-[0_8px_16px_-6px_rgba(79,70,229,0.5)] hover:bg-indigo-600 hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
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
}

