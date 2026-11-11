import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NavigationUiService } from './navigation-ui.service';

describe('NavigationUiService', () => {
  let service: NavigationUiService;
  let events: Subject<unknown>;
  let router: { url: string; events: Subject<unknown> };

  beforeEach(() => {
    localStorage.clear();
    events = new Subject();
    router = { url: '/collection', events };
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
    service = TestBed.inject(NavigationUiService);
  });

  it('starts with the current url and derives the active destinations', () => {
    expect(service.currentUrl()).toBe('/collection');
    expect(service.isActive('nav-collection')).toBe(true);
    expect(service.isActive('nav-shelves')).toBe(false);
    expect(service.isActive(undefined)).toBe(false);
  });

  it('follows navigation events and closes overlays', () => {
    service.openPalette();
    service.toggleMore();
    expect(service.paletteOpen()).toBe(false);

    service.openPalette();
    events.next(new NavigationEnd(1, '/collection?view=shelves', '/collection?view=shelves'));

    expect(service.currentUrl()).toBe('/collection?view=shelves');
    expect(service.isActive('nav-shelves')).toBe(true);
    expect(service.isActive('nav-collection')).toBe(false);
    expect(service.paletteOpen()).toBe(false);
    expect(service.moreOpen()).toBe(false);
  });

  it('remembers the rail width', () => {
    expect(service.railExpanded()).toBe(false);

    service.toggleRail();

    expect(service.railExpanded()).toBe(true);
    expect(localStorage.getItem('navigation.railExpanded')).toBe('true');

    service.setRailExpanded(false);
    expect(service.railExpanded()).toBe(false);
    expect(localStorage.getItem('navigation.railExpanded')).toBe('false');
  });

  it('restores the stored rail width', () => {
    localStorage.setItem('navigation.railExpanded', 'true');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });

    expect(TestBed.inject(NavigationUiService).railExpanded()).toBe(true);
  });

  it('keeps palette and more sheet mutually exclusive', () => {
    service.toggleMore();
    expect(service.moreOpen()).toBe(true);

    service.openPalette();
    expect(service.paletteOpen()).toBe(true);
    expect(service.moreOpen()).toBe(false);

    service.toggleMore();
    expect(service.moreOpen()).toBe(true);
    expect(service.paletteOpen()).toBe(false);

    service.closeMore();
    expect(service.moreOpen()).toBe(false);
  });

  it('toggles the palette', () => {
    service.togglePalette();
    expect(service.paletteOpen()).toBe(true);

    service.togglePalette();
    expect(service.paletteOpen()).toBe(false);

    service.openPalette();
    service.closePalette();
    expect(service.paletteOpen()).toBe(false);
  });

  it('works without a router (isolated component tests)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    const isolated = TestBed.inject(NavigationUiService);

    expect(isolated.currentUrl()).toBe('/');
    isolated.openPalette();
    expect(isolated.paletteOpen()).toBe(true);
  });
});
