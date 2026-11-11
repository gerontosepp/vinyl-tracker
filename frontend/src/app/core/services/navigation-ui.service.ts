import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NAV_ITEMS, isNavItemActive } from '../navigation';

const RAIL_STORAGE_KEY = 'navigation.railExpanded';

function readRailExpanded(): boolean {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistRailExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(RAIL_STORAGE_KEY, String(expanded));
  } catch {
    // Private mode or blocked storage: the rail simply starts collapsed next time.
  }
}

/**
 * Shared state of the app chrome: rail width, command palette, "more" sheet and the current URL
 * used for active navigation items. Components stay free of duplicated open/close logic.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationUiService {
  private readonly router = inject(Router, { optional: true });

  readonly railExpanded = signal(readRailExpanded());
  readonly paletteOpen = signal(false);
  readonly moreOpen = signal(false);
  readonly currentUrl = signal(this.router?.url ?? '/');

  /** Test ids of the currently active destinations (a path may have several variants). */
  readonly activeItemIds = computed(() => {
    const url = this.currentUrl();
    return new Set(
      NAV_ITEMS.filter((item) => isNavItemActive(item, url))
        .map((item) => item.testId)
        .filter((id): id is string => Boolean(id)),
    );
  });

  constructor() {
    this.router?.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        // Navigation closes overlays, no matter where it was triggered.
        this.paletteOpen.set(false);
        this.moreOpen.set(false);
      });
  }

  setRailExpanded(expanded: boolean): void {
    this.railExpanded.set(expanded);
    persistRailExpanded(expanded);
  }

  toggleRail(): void {
    this.setRailExpanded(!this.railExpanded());
  }

  openPalette(): void {
    this.moreOpen.set(false);
    this.paletteOpen.set(true);
  }

  closePalette(): void {
    this.paletteOpen.set(false);
  }

  togglePalette(): void {
    if (this.paletteOpen()) {
      this.closePalette();
    } else {
      this.openPalette();
    }
  }

  toggleMore(): void {
    this.paletteOpen.set(false);
    this.moreOpen.set(!this.moreOpen());
  }

  closeMore(): void {
    this.moreOpen.set(false);
  }

  isActive(testId: string | undefined): boolean {
    return Boolean(testId && this.activeItemIds().has(testId));
  }
}
