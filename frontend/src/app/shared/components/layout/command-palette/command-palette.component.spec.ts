import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { CommandPaletteComponent } from './command-palette.component';
import { LanguageService } from '../../../../core/services/language.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { NAV_ITEMS } from '../../../../core/navigation';

describe('CommandPaletteComponent', () => {
  let fixture: ComponentFixture<CommandPaletteComponent>;
  let component: CommandPaletteComponent;
  const paletteOpen = signal(true);
  const isDark = signal(false);
  const ui = {
    paletteOpen,
    closePalette: vi.fn().mockName('closePalette'),
  };
  const theme = {
    isDark,
    toggle: vi.fn().mockName('toggleTheme'),
  };
  const scanner = { closeScanner: vi.fn().mockName('closeScanner') };
  const router = { navigate: vi.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    paletteOpen.set(true);
    ui.closePalette.mockClear();
    theme.toggle.mockClear();
    scanner.closeScanner.mockClear();
    router.navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [
        { provide: NavigationUiService, useValue: ui },
        { provide: ThemeService, useValue: theme },
        { provide: ScannerService, useValue: scanner },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    TestBed.inject(LanguageService).setLanguage('de');
    fixture = TestBed.createComponent(CommandPaletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const items = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid^="palette-"]'));

  it('offers the three global actions and every desktop destination', () => {
    const language = TestBed.inject(LanguageService);
    const desktopItems = NAV_ITEMS.filter((item) => !item.phoneOnly && !item.action);

    expect(component.visible().length).toBe(desktopItems.length + 3);

    const labels = items().map((item) => item.textContent?.trim());
    expect(labels[0]).toContain(language.translate('palette.scan'));
    expect(labels.some((label) => label?.includes(language.translate('nav.labelInbox')))).toBe(true);
    // Sorting a shelf stack is a phone-only workflow and stays out of the palette
    expect(labels.some((label) => label?.includes(language.translate('nav.sort')))).toBe(false);
  });

  it('renders nothing while it is closed', () => {
    paletteOpen.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('filters by the typed term', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'regal';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.visible().map((entry) => entry.id)).toEqual(['nav-shelves']);
  });

  it('shows an empty state without matches', () => {
    component.query.set('zzz');
    fixture.detectChanges();

    expect(component.visible()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Keine Treffer');
  });

  it('navigates to the highlighted destination on Enter', () => {
    component.query.set('regale');
    fixture.detectChanges();

    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(ui.closePalette).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/collection'], {
      queryParams: { view: 'shelves' },
    });
    expect(scanner.closeScanner).toHaveBeenCalled();
  });

  it('moves the highlight with the arrow keys and wraps around', () => {
    expect(component.active()).toBe(0);

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.active()).toBe(1);

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.active()).toBe(0);

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(component.active()).toBe(component.visible().length - 1);

    component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(component.active()).toBe(0);
  });

  it('closes on Escape', () => {
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(ui.closePalette).toHaveBeenCalled();
  });

  it('emits scan from the scan action', () => {
    const emitted = vi.fn();
    component.scan.subscribe(emitted);

    const scan = fixture.nativeElement.querySelector('[data-testid="palette-action-scan"]');
    scan.click();

    expect(ui.closePalette).toHaveBeenCalled();
    expect(emitted).toHaveBeenCalled();
  });

  it('switches language and theme from the palette actions', () => {
    const language = TestBed.inject(LanguageService);
    const initial = language.language();

    component.choose(component.visible()[1]);
    expect(language.language()).not.toBe(initial);

    component.choose(component.visible()[2]);
    expect(theme.toggle).toHaveBeenCalled();

    language.setLanguage(initial);
  });

  it('closes when the backdrop is clicked, but not when the dialog is clicked', () => {
    const backdrop: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]')
      .parentElement as HTMLElement;

    fixture.nativeElement.querySelector('[role="dialog"]').click();
    expect(ui.closePalette).not.toHaveBeenCalled();

    backdrop.click();
    expect(ui.closePalette).toHaveBeenCalled();
  });
});
