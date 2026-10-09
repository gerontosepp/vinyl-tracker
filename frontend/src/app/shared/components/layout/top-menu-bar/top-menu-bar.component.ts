import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LucideLogOut, LucideSettings, LucideGlobe } from '@lucide/angular';

@Component({
  selector: 'app-top-menu-bar',
  standalone: true,
  imports: [RouterLink, LucideLogOut, LucideSettings, LucideGlobe, TranslatePipe],
  template: `
    @if (authService.user(); as user) {
      <header
        class="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700 z-30 px-4 md:px-8 flex items-center justify-between transition-colors shadow-sm"
      >
        <!-- Logo / Left Side -->
        <a
          routerLink="/"
          (click)="scannerService.closeScanner()"
          class="flex items-center gap-2 md:gap-3 cursor-pointer group"
          title="Home"
        >
          <img
            src="/logo.png"
            alt="Logo"
            class="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-sm group-hover:scale-105 transition-transform"
          />
          <span class="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tighter">
            Vinyl<span class="text-indigo-600 dark:text-indigo-400">Tracker</span>
          </span>
        </a>

        <!-- Right - User Area & Quick Language Switcher -->
        <div class="flex items-center gap-3">
          <!-- Language Pill Switcher -->
          <button
            (click)="toggleLanguage()"
            class="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            [title]="languageService.language() === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'"
          >
            <svg lucideGlobe [size]="14"></svg>
            <span class="uppercase tracking-wider">{{ languageService.language() }}</span>
          </button>

          <div class="flex flex-col items-end hidden md:flex">
            <span class="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
              {{ user.username }}
            </span>
            <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              v{{ appVersion }}
            </span>
          </div>

          <div
            class="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all font-bold"
          >
            {{ user.username.charAt(0).toUpperCase() }}
          </div>

          <div class="flex items-center gap-2 ml-1 pl-3 border-l border-slate-200 dark:border-slate-700">
            <a
              routerLink="/settings"
              class="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              [title]="'nav.settings' | translate"
            >
              <svg lucideSettings [size]="20"></svg>
            </a>
            <button
              (click)="logout()"
              class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
              [title]="'nav.logout' | translate"
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
  private readonly router = inject(Router);

  readonly appVersion = '0.3.1';

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

