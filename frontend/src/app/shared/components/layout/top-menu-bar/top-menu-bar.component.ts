import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { APP_VERSION } from '../../../../core/constants/release-info.data';
import {
  LucideCircleQuestionMark,
  LucideGlobe,
  LucideLogOut,
  LucideMoon,
  LucideSearch,
  LucideSun,
} from '@lucide/angular';
import { TooltipDirective } from '../../../directives/tooltip.directive';

@Component({
  selector: 'app-top-menu-bar',
  standalone: true,
  imports: [
    RouterLink,
    LucideCircleQuestionMark,
    LucideGlobe,
    LucideLogOut,
    LucideMoon,
    LucideSearch,
    LucideSun,
    TranslatePipe,
    TooltipDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (authService.user(); as user) {
      <header
        class="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700 z-30 px-4 md:px-8 flex items-center gap-3 md:gap-5 transition-colors shadow-sm"
      >
        <!-- Logo / Left Side -->
        <a
          routerLink="/"
          (click)="scannerService.closeScanner()"
          class="flex items-center gap-2 md:gap-3 cursor-pointer group shrink-0"
          [appTooltip]="'nav.home' | translate"
        >
          <img
            src="/favicon.svg"
            alt="Logo"
            class="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-sm group-hover:scale-105 transition-transform"
          />
          <span class="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tighter">
            Vinyl<span class="text-indigo-600 dark:text-indigo-400">Tracker</span>
          </span>
          <!-- On desktop the version sits below the username -->
          <span
            class="md:hidden text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider self-end mb-1"
            data-testid="mobile-version"
          >
            v{{ appVersion }}
          </span>
        </a>

        <!-- Command palette trigger (desktop) -->
        <button
          type="button"
          (click)="ui.openPalette()"
          data-testid="palette-trigger"
          [attr.aria-label]="'nav.openPalette' | translate"
          class="hidden md:flex items-center gap-2 w-full max-w-xs lg:max-w-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs font-medium hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer"
        >
          <svg lucideSearch [size]="15"></svg>
          <span class="truncate">{{ 'nav.openPalette' | translate }}</span>
          <kbd
            class="ml-auto shrink-0 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold"
            >⌘K</kbd
          >
        </button>

        <div class="flex-1 md:hidden"></div>
        <div class="hidden md:block md:flex-1"></div>

        <div class="flex items-center gap-1.5 md:gap-3">
          <!-- Command palette (mobile) -->
          <button
            type="button"
            (click)="ui.openPalette()"
            data-testid="palette-trigger-mobile"
            [attr.aria-label]="'nav.openPalette' | translate"
            class="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <svg lucideSearch [size]="20"></svg>
          </button>

          <!-- Language Pill Switcher -->
          <button
            (click)="toggleLanguage()"
            class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            [appTooltip]="'nav.switchLanguage' | translate"
          >
            <svg lucideGlobe [size]="14"></svg>
            <span class="uppercase tracking-wider">{{ languageService.language() }}</span>
          </button>

          <!-- Theme toggle (desktop; on phones via palette and settings) -->
          <button
            (click)="themeService.toggle()"
            data-testid="theme-toggle"
            class="hidden md:flex p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            [appTooltip]="'nav.toggleTheme' | translate"
            [attr.aria-label]="'nav.toggleTheme' | translate"
          >
            @if (themeService.isDark()) {
              <svg lucideSun [size]="19"></svg>
            } @else {
              <svg lucideMoon [size]="19"></svg>
            }
          </button>

          <div class="flex flex-col items-end hidden md:flex">
            <span class="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
              {{ user.username }}
            </span>
            <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              v{{ appVersion }}
            </span>
          </div>

          <div class="flex items-center gap-2 ml-1 pl-3 border-l border-slate-200 dark:border-slate-700">
            <a
              routerLink="/help"
              (click)="scannerService.closeScanner()"
              class="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              [appTooltip]="'nav.help' | translate"
              data-testid="nav-help-mobile"
            >
              <svg lucideCircleQuestionMark [size]="20"></svg>
            </a>
            <button
              (click)="logout()"
              class="hidden md:flex text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
              [appTooltip]="'nav.logout' | translate"
            >
              <svg lucideLogOut [size]="20"></svg>
            </button>
          </div>
        </div>
      </header>
    }
  `,
})
export class TopMenuBarComponent {
  readonly authService = inject(AuthService);
  readonly languageService = inject(LanguageService);
  readonly scannerService = inject(ScannerService);
  readonly themeService = inject(ThemeService);
  readonly ui = inject(NavigationUiService);
  private readonly router = inject(Router);

  readonly appVersion = APP_VERSION;

  toggleLanguage(): void {
    const current = this.languageService.language();
    this.languageService.setLanguage(current === 'de' ? 'en' : 'de');
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}
