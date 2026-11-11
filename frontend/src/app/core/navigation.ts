import type { Params } from '@angular/router';

/** Icons available to the shared navigation (see `NavIconComponent`). */
export type NavIcon =
  | 'home'
  | 'disc'
  | 'shelf'
  | 'sort'
  | 'bookmark'
  | 'inbox'
  | 'settings'
  | 'help'
  | 'more'
  | 'scan'
  | 'globe'
  | 'theme';

export type NavSurface = 'rail' | 'bottom' | 'more';

/**
 * A destination that appears in the navigation. One entry per route so the desktop rail, the
 * mobile bottom bar and the "more" sheet cannot drift apart (see ADR in docs/design).
 */
export interface NavItem {
  /** Router path without query parameters. */
  path: string;
  /** Translation key of the visible label. */
  labelKey: string;
  icon: NavIcon;
  /**
   * Where the item is shown, with the order for that surface. An item may appear on several
   * surfaces with a different position on each (e.g. collection is first in the rail but second
   * in the bottom bar).
   */
  surfaces: Partial<Record<NavSurface, number>>;
  /** Query parameters needed to reach the destination (e.g. the shelf view). */
  queryParams?: Params;
  /** Query parameters that must match for the item to look active. */
  activeQuery?: Params;
  /** Query parameters that must not be set (sibling destinations of the same path). */
  inactiveQuery?: Params;
  /** Extra paths that count as this destination (e.g. /profile opens the settings page). */
  matchPaths?: string[];
  /** Only the exact path counts as active. */
  exact?: boolean;
  /** Phone-only destinations are not offered in the desktop rail or the command palette. */
  phoneOnly?: boolean;
  /** An action instead of a route (the scanner); it has no `path`. */
  action?: 'scan';
  /** Pinned to the bottom edge of the desktop rail (help), independent of the list above. */
  pinned?: boolean;
  /** Stable hook for tests. */
  testId?: string;
}

/**
 * All navigation destinations. Paths must stay unique per query variant, `testId` must be unique.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/',
    labelKey: 'nav.home',
    icon: 'home',
    surfaces: { rail: 10, bottom: 10 },
    exact: true,
    testId: 'nav-home',
  },
  {
    path: '/collection',
    labelKey: 'nav.collection',
    icon: 'disc',
    surfaces: { rail: 20, bottom: 20 },
    inactiveQuery: { view: 'shelves' },
    testId: 'nav-collection',
  },
  {
    path: '/collection',
    labelKey: 'nav.shelves',
    icon: 'shelf',
    surfaces: { rail: 30, more: 10 },
    queryParams: { view: 'shelves' },
    activeQuery: { view: 'shelves' },
    testId: 'nav-shelves',
  },
  {
    path: '/sort',
    labelKey: 'nav.sort',
    icon: 'sort',
    // Sorting a shelf stack is a phone workflow, so the entry only lives in the mobile sheet.
    surfaces: { more: 20 },
    phoneOnly: true,
    testId: 'nav-sort',
  },
  {
    path: '/want-to-have',
    labelKey: 'nav.wantToHave',
    icon: 'bookmark',
    surfaces: { rail: 40, bottom: 30 },
    testId: 'nav-want-to-have',
  },
  {
    // Scan is an action, not a route: it sits in the menu where the rail expects it, with the
    // same icon size and padding as every destination.
    path: '',
    labelKey: 'nav.scan',
    icon: 'scan',
    surfaces: { rail: 50 },
    action: 'scan',
    testId: 'nav-scan',
  },
  {
    path: '/label-inbox',
    labelKey: 'nav.labelInbox',
    icon: 'inbox',
    surfaces: { rail: 60, more: 40 },
    testId: 'nav-label-inbox',
  },
  {
    path: '/help',
    labelKey: 'nav.help',
    icon: 'help',
    // Sits at the bottom edge of the rail, below the settings entry.
    surfaces: { rail: 80, more: 60 },
    pinned: true,
    testId: 'nav-help',
  },
  {
    path: '/settings',
    labelKey: 'nav.settings',
    icon: 'settings',
    surfaces: { rail: 70, more: 50 },
    matchPaths: ['/profile'],
    testId: 'nav-settings',
  },
];

/** Items of one surface, in their configured order. */
export function navItemsFor(surface: NavSurface): NavItem[] {
  return NAV_ITEMS.filter((item) => item.surfaces[surface] !== undefined).sort(
    (a, b) => (a.surfaces[surface] ?? 0) - (b.surfaces[surface] ?? 0),
  );
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const trimmed = path.split('?')[0].split('#')[0];
  const withoutSlash = trimmed.replace(/\/+$/, '');
  return withoutSlash || '/';
}

function matchesPath(item: NavItem, path: string): boolean {
  const target = normalizePath(item.path);
  if (item.exact) {
    return path === target;
  }
  const candidates = [target, ...(item.matchPaths ?? []).map(normalizePath)];
  return candidates.some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
}

function queryMatches(params: URLSearchParams, expected?: Params): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => params.get(key) === String(value));
}

/**
 * Whether `url` belongs to `item`. Query parameters are compared explicitly so the list and the
 * shelf view of `/collection` do not both look active.
 */
export function isNavItemActive(item: NavItem, url: string): boolean {
  if (item.action) return false;
  const [rawPath, rawQuery = ''] = (url || '/').split('?');
  const path = normalizePath(rawPath);
  const params = new URLSearchParams(rawQuery);

  return (
    matchesPath(item, path) &&
    queryMatches(params, item.activeQuery) &&
    !Object.entries(item.inactiveQuery ?? {}).some(([key, value]) => params.get(key) === String(value))
  );
}
