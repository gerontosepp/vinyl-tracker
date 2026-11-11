import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar.component';
import { ScannerService } from '../../../../core/services/scanner.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { navItemsFor } from '../../../../core/navigation';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockScannerService: any;
  let ui: NavigationUiService;

  beforeEach(async () => {
    localStorage.clear();
    mockScannerService = {
      showScanner: signal(false),
      closeScanner: vi.fn().mockName('closeScanner'),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: ScannerService, useValue: mockScannerService },
      ],
    }).compileComponents();

    ui = TestBed.inject(NavigationUiService);
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders every rail destination from the shared configuration', () => {
    const ids = Array.from(
      fixture.nativeElement.querySelectorAll('nav [data-testid]'),
      (el: Element) => el.getAttribute('data-testid'),
    );

    expect(ids).toEqual(navItemsFor('rail').map((item) => item.testId));
  });

  it('puts scanning between want-to-have and the label inbox, with the same icon size', () => {
    const el: HTMLElement = fixture.nativeElement;
    const ids = Array.from(
      el.querySelectorAll('nav [data-testid]'),
      (node: Element) => node.getAttribute('data-testid'),
    );
    expect(ids.indexOf('nav-scan')).toBe(4);

    const icons = Array.from(el.querySelectorAll('nav [data-testid] > app-nav-icon svg'));
    expect(icons).toHaveLength(navItemsFor('rail').length);
    for (const icon of icons) {
      expect(icon.getAttribute('width')).toBe('22');
    }
  });

  it('pins help to the bottom edge of the rail', () => {
    const nav: HTMLElement = fixture.nativeElement.querySelector('nav');
    const separator = nav.querySelector('div.mt-auto') as HTMLElement;
    const help = nav.querySelector('[data-testid="nav-help"]') as HTMLElement;

    expect(separator).toBeTruthy();
    expect(separator.nextElementSibling).toBe(help);
    expect(nav.lastElementChild).toBe(help);
    expect(nav.querySelector('[data-testid="nav-settings"]')).toBeTruthy();
  });

  it('links to the help page, the settings page and the label inbox', () => {
    const el: HTMLElement = fixture.nativeElement;
    const help = el.querySelector<HTMLAnchorElement>('[data-testid="nav-help"]')!;
    const settings = el.querySelector<HTMLAnchorElement>('[data-testid="nav-settings"]')!;
    const inbox = el.querySelector<HTMLAnchorElement>('[data-testid="nav-label-inbox"]')!;

    expect(help.getAttribute('href')).toBe('/help');
    expect(settings.getAttribute('href')).toBe('/settings');
    expect(inbox.getAttribute('href')).toBe('/label-inbox');

    help.click();
    expect(mockScannerService.closeScanner).toHaveBeenCalled();
  });

  it('reaches the shelf view through the collection query parameter', () => {
    const shelves: HTMLAnchorElement = fixture.nativeElement.querySelector(
      '[data-testid="nav-shelves"]',
    );

    expect(shelves.getAttribute('href')).toBe('/collection?view=shelves');
  });

  it('marks the destination of the current url', () => {
    ui.currentUrl.set('/collection?view=shelves');
    fixture.detectChanges();

    const shelves: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="nav-shelves"]',
    );
    const list: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="nav-collection"]',
    );

    expect(shelves.className).toContain('text-indigo-600');
    expect(shelves.getAttribute('aria-current')).toBe('page');
    expect(list.className).toContain('text-slate-400');
    expect(list.getAttribute('aria-current')).toBeNull();
  });

  it('hides the labels while the rail is collapsed and shows them when expanded', () => {
    const el: HTMLElement = fixture.nativeElement;
    const labels = () => el.querySelectorAll('nav [data-testid] span');

    expect(ui.railExpanded()).toBe(false);
    expect(labels().length).toBe(0);
    expect(el.querySelector('aside')?.className).toContain('w-[88px]');

    const open: HTMLButtonElement = el.querySelector('[data-testid="rail-toggle"]')!;
    open.click();
    fixture.detectChanges();

    expect(ui.railExpanded()).toBe(true);
    expect(labels().length).toBe(navItemsFor('rail').length);
    expect(el.querySelector('aside')?.className).toContain('w-[232px]');
  });

  it('expands and collapses the rail with the toggle', () => {
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="rail-toggle"]',
    );

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('emits scanClick from the primary action', () => {
    const emitted = vi.fn();
    component.scanClick.subscribe(emitted);

    const scan: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="nav-scan"]');
    expect(scan.getAttribute('aria-label')).toBeTruthy();
    scan.click();

    expect(emitted).toHaveBeenCalled();
  });

  it('uses the active and inactive item styles', () => {
    expect(component.itemClass(true)).toContain('text-indigo-600');
    expect(component.itemClass(true)).toContain('font-bold');
    expect(component.itemClass(false)).toContain('text-slate-400');
  });
});
