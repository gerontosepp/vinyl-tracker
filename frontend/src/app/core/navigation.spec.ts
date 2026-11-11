import { NAV_ITEMS, isNavItemActive, navItemsFor, type NavItem } from './navigation';

const byTestId = (testId: string): NavItem => {
  const item = NAV_ITEMS.find((candidate) => candidate.testId === testId);
  if (!item) throw new Error(`Unknown navigation item ${testId}`);
  return item;
};

describe('navigation configuration', () => {
  it('keeps test ids unique so every destination is addressable in tests', () => {
    const ids = NAV_ITEMS.map((item) => item.testId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  it('shows every destination on at least one surface', () => {
    for (const item of NAV_ITEMS) {
      expect(Object.keys(item.surfaces).length).toBeGreaterThan(0);
    }
  });

  it('orders the rail: start, collection, shelves, want-to-have, scan, inbox, settings and help at the bottom', () => {
    expect(navItemsFor('rail').map((item) => item.testId)).toEqual([
      'nav-home',
      'nav-collection',
      'nav-shelves',
      'nav-want-to-have',
      'nav-scan',
      'nav-label-inbox',
      'nav-settings',
      'nav-help',
    ]);
  });

  it('pins help to the bottom edge of the rail', () => {
    const help = byTestId('nav-help');
    const settings = byTestId('nav-settings');

    expect(help.pinned).toBe(true);
    expect(settings.pinned).toBeUndefined();
    expect(navItemsFor('rail').at(-1)?.testId).toBe('nav-help');
  });

  it('treats the scanner as an action without a route', () => {
    const scan = byTestId('nav-scan');

    expect(scan.action).toBe('scan');
    expect(scan.path).toBe('');
    expect(isNavItemActive(scan, '/')).toBe(false);
    expect(isNavItemActive(scan, '/collection')).toBe(false);
  });

  it('keeps the phone-only sort mode out of the desktop surfaces', () => {
    const sort = byTestId('nav-sort');

    expect(sort.phoneOnly).toBe(true);
    expect(sort.surfaces.rail).toBeUndefined();
    expect(navItemsFor('rail').some((item) => item.testId === 'nav-sort')).toBe(false);
    expect(navItemsFor('more').some((item) => item.testId === 'nav-sort')).toBe(true);
  });

  it('keeps the bar short and moves everything else into the more sheet', () => {
    expect(navItemsFor('bottom').map((item) => item.testId)).toEqual([
      'nav-home',
      'nav-collection',
      'nav-want-to-have',
    ]);
    expect(navItemsFor('more').map((item) => item.testId)).toEqual([
      'nav-shelves',
      'nav-sort',
      'nav-label-inbox',
      'nav-settings',
      'nav-help',
    ]);
  });

  describe('isNavItemActive', () => {
    it('matches the dashboard only exactly', () => {
      const home = byTestId('nav-home');

      expect(isNavItemActive(home, '/')).toBe(true);
      expect(isNavItemActive(home, '/collection')).toBe(false);
      expect(isNavItemActive(home, '/sort')).toBe(false);
    });

    it('separates the list and the shelf view of the collection', () => {
      const list = byTestId('nav-collection');
      const shelves = byTestId('nav-shelves');

      expect(isNavItemActive(list, '/collection')).toBe(true);
      expect(isNavItemActive(list, '/collection?search=ambient')).toBe(true);
      expect(isNavItemActive(list, '/collection?view=shelves')).toBe(false);

      expect(isNavItemActive(shelves, '/collection?view=shelves')).toBe(true);
      expect(isNavItemActive(shelves, '/collection')).toBe(false);
    });

    it('treats the settings page and the profile route as the same destination', () => {
      const settings = byTestId('nav-settings');

      expect(isNavItemActive(settings, '/settings')).toBe(true);
      expect(isNavItemActive(settings, '/profile')).toBe(true);
      expect(isNavItemActive(settings, '/help')).toBe(false);
    });

    it('ignores trailing slashes and empty urls', () => {
      expect(isNavItemActive(byTestId('nav-help'), '/help/')).toBe(true);
      expect(isNavItemActive(byTestId('nav-collection'), '')).toBe(false);
    });

    it('never marks siblings of the same path as active at once', () => {
      const active = NAV_ITEMS.filter((item) => isNavItemActive(item, '/collection?view=shelves'));
      expect(active).toHaveLength(1);
      expect(active[0].testId).toBe('nav-shelves');
    });
  });
});
