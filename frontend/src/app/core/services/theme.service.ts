import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    // Sync theme class to document element on change
    effect(() => {
      const currentTheme = this.theme();
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      if (currentTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(currentTheme);
      }

      localStorage.setItem('theme', currentTheme);
    });

    // Listen to media query changes when theme is system
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (this.theme() === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(e.matches ? 'dark' : 'light');
      }
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  private getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'system';
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'system';
  }
}
