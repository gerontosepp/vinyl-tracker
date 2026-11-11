import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { BottomNavComponent } from './bottom-nav.component';
import { LanguageService } from '../../../../core/services/language.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { AuthService } from '../../../../core/services/auth.service';
import { navItemsFor } from '../../../../core/navigation';

describe('BottomNavComponent', () => {
  let component: BottomNavComponent;
  let fixture: ComponentFixture<BottomNavComponent>;
  const showScanner = signal(false);
  const scanner = { showScanner, closeScanner: vi.fn() };
  const auth = { logout: vi.fn().mockResolvedValue(undefined) };
  let ui: NavigationUiService;
  let router: Router;

  beforeEach(async () => {
    showScanner.set(false);
    scanner.closeScanner.mockReset();
    auth.logout.mockClear();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        provideRouter([]),
        { provide: ScannerService, useValue: scanner },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    ui = TestBed.inject(NavigationUiService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(BottomNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the three primary destinations plus the more button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const items = Array.from(el.querySelectorAll('nav > a, nav > button'));

    const language = TestBed.inject(LanguageService);
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(
      [...navItemsFor('bottom'), { labelKey: 'nav.more' }].map((item) =>
        language.translate(item.labelKey),
      ),
    );
  });

  it('keeps a free slot in the middle for the scan button', () => {
    const spacer = fixture.nativeElement.querySelector('nav > span[aria-hidden="true"]');
    expect(spacer).toBeTruthy();
  });

  it('marks the current destination', () => {
    ui.currentUrl.set('/collection');
    fixture.detectChanges();

    const collection: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="nav-collection"]',
    );
    const home: HTMLElement = fixture.nativeElement.querySelector('[data-testid="nav-home"]');

    expect(collection.className).toContain('text-indigo-600');
    expect(collection.getAttribute('aria-current')).toBe('page');
    expect(home.className).toContain('text-slate-400');
  });

  it('opens the more sheet with sort, inbox, settings, help and logout', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="nav-sort"]')).toBeNull();

    const more: HTMLButtonElement = el.querySelector('[data-testid="nav-more"]')!;
    more.click();
    fixture.detectChanges();

    expect(more.getAttribute('aria-expanded')).toBe('true');
    for (const testId of ['nav-shelves', 'nav-sort', 'nav-label-inbox', 'nav-settings', 'nav-help', 'nav-logout']) {
      expect(el.querySelector(`[data-testid="${testId}"]`)).toBeTruthy();
    }
  });

  it('closes the sheet and the scanner when a destination is chosen', () => {
    ui.toggleMore();
    fixture.detectChanges();

    const sort: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="nav-sort"]');
    expect(sort.getAttribute('href')).toBe('/sort');
    sort.click();
    fixture.detectChanges();

    expect(scanner.closeScanner).toHaveBeenCalled();
    expect(ui.moreOpen()).toBe(false);
  });

  it('closes the sheet when the backdrop is clicked', () => {
    ui.toggleMore();
    fixture.detectChanges();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.click();
    fixture.detectChanges();

    expect(ui.moreOpen()).toBe(false);
  });

  it('logs out from the sheet and returns to the login page', async () => {
    ui.toggleMore();
    fixture.detectChanges();

    const logout: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="nav-logout"]',
    );
    logout.click();
    await fixture.whenStable();

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(ui.moreOpen()).toBe(false);
  });

  it('uses the active and inactive styles', () => {
    expect(component.itemClass(true)).toContain('text-indigo-600');
    expect(component.itemClass(false)).toContain('text-slate-400');
    expect(component.sheetItemClass(true)).toContain('bg-indigo-50');
    expect(component.sheetItemClass(false)).toContain('text-slate-600');
  });
});
