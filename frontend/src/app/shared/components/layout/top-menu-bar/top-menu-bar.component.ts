import { Component, inject, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiService } from '../../../../core/services/api.service';
import { LucideLogOut, LucideSettings } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-top-menu-bar',
  standalone: true,
  imports: [RouterLink, LucideLogOut, LucideSettings],
  template: `
    @if (authService.user(); as user) {
      <header
        class="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700 z-30 px-4 md:px-8 flex items-center justify-between transition-colors shadow-sm"
      >
        <!-- Logo / Left Side -->
        <div class="flex items-center gap-2 md:gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            class="w-8 h-8 md:w-10 md:h-10 rounded-full shadow-sm"
          />
          <span class="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tighter">
            Vinyl<span class="text-indigo-600 dark:text-indigo-400">Tracker</span>
          </span>
        </div>

        <!-- Center - Stats -->
        <div class="hidden sm:flex flex-1 justify-center items-center">
          <span
            class="text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700"
          >
            Total Records:
            @if (totalRecords() !== null) {
              <strong class="text-indigo-600 dark:text-indigo-400">{{ totalRecords() }}</strong>
            } @else {
              <span class="w-6 h-4 inline-block bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
            }
          </span>
        </div>

        <!-- Right - User Area -->
        <div class="flex items-center gap-4">
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

          <div class="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200 dark:border-slate-700">
            <a
              routerLink="/settings"
              class="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Settings"
            >
              <svg lucideSettings [size]="20"></svg>
            </a>
            <button
              (click)="logout()"
              class="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Log Out"
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
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);

  readonly totalRecords = signal<number | null>(null);
  readonly appVersion = '2.0.0';

  constructor() {
    effect(() => {
      const user = this.authService.user();
      if (user?.username) {
        this.fetchTotalRecords(user.username);
      } else {
        this.totalRecords.set(null);
      }
    });
  }

  private async fetchTotalRecords(username: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.apiService.getCollection(username, 1, 1));
      this.totalRecords.set(res.pagination ? res.pagination.items : res.releases.length);
    } catch (err) {
      console.error('Failed to fetch total records for top bar', err);
    }
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }
}
