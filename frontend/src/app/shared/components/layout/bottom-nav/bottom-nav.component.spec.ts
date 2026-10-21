import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../../../core/services/language.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { BottomNavComponent } from './bottom-nav.component';

describe('BottomNavComponent', () => {
  const showScanner = signal(false);
  const scanner = { showScanner, closeScanner: vi.fn() };

  function render(): { el: HTMLElement; component: BottomNavComponent; detect: () => void } {
    showScanner.set(false);
    scanner.closeScanner.mockReset();
    TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [provideRouter([]), { provide: ScannerService, useValue: scanner }],
    });
    const fixture = TestBed.createComponent(BottomNavComponent);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      component: fixture.componentInstance,
      detect: () => fixture.detectChanges(),
    };
  }

  it('shows five equally styled entries including scan and sort', () => {
    const { el } = render();
    const items = Array.from(el.querySelectorAll('nav > a, nav > button'));

    const language = TestBed.inject(LanguageService);

    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(
      ['nav.home', 'nav.collection', 'nav.scan', 'nav.sort', 'nav.profile'].map((key) => language.translate(key)),
    );
    for (const item of items) {
      expect(item.className).toContain('p-3');
      expect(item.querySelector('svg')?.getAttribute('width')).toBe('28');
    }
  });

  it('opens the sort mode from the shelf icon', () => {
    const { el } = render();
    const sort = el.querySelector<HTMLAnchorElement>('[data-testid="nav-sort"]')!;

    expect(sort.getAttribute('href')).toBe('/sort');
    sort.click();
    expect(scanner.closeScanner).toHaveBeenCalled();
  });

  it('emits a scan click and highlights scan while the scanner is open', () => {
    const { el, component, detect } = render();
    const emitted = vi.fn();
    component.scanClick.subscribe(emitted);
    const scan = el.querySelector<HTMLButtonElement>('[data-testid="nav-scan"]')!;

    expect(scan.className).toContain('text-slate-400');
    scan.click();
    expect(emitted).toHaveBeenCalled();

    showScanner.set(true);
    detect();
    expect(scan.className).toContain('text-indigo-600');
    expect(el.querySelector('[aria-label]')?.className).toContain('text-slate-400');
  });

  it('marks only the active entry', () => {
    const { component } = render();

    expect(component.itemClass(true)).toContain('text-indigo-600');
    expect(component.itemClass(false)).toContain('text-slate-400');
  });
});
