import { Injectable, signal, effect, computed } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function prefersDark(): boolean {
  // jsdom (unit tests) and non-browser environments have no matchMedia.
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly theme = signal<Theme>(this.getInitialTheme());

  /** Whether the dark scheme is currently applied (also resolves `system`). */
  readonly isDark = computed(() => {
    const theme = this.theme();
    return theme === 'system' ? this.systemDark() : theme === 'dark';
  });

  private readonly systemDark = signal(prefersDark());

  constructor() {
    // Sync theme class to document element on change
    effect(() => {
      const currentTheme = this.theme();
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(
        currentTheme === 'system' ? (this.systemDark() ? 'dark' : 'light') : currentTheme,
      );

      try {
        localStorage.setItem('theme', currentTheme);
      } catch {
        // Blocked storage: the theme still applies for this session.
      }
    });

    // Listen to media query changes when theme is system
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
        this.systemDark.set(event.matches);
        if (this.theme() === 'system') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(event.matches ? 'dark' : 'light');
        }
      });
    }
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  /** Flips between the explicit light and dark schemes. */
  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'system';
    try {
      const savedTheme = localStorage.getItem('theme') as Theme;
      return savedTheme || 'system';
    } catch {
      return 'system';
    }
  }
}
