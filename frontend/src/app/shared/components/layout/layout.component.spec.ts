import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LayoutComponent } from './layout.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { BottomNavComponent } from './bottom-nav/bottom-nav.component';
import { TopMenuBarComponent } from './top-menu-bar/top-menu-bar.component';
import { CommandPaletteComponent } from './command-palette/command-palette.component';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationUiService } from '../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { Router } from '@angular/router';
import { Component, signal, NO_ERRORS_SCHEMA, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
class MockSidebarComponent {}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
class MockBottomNavComponent {}

@Component({
  selector: 'app-top-menu-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
class MockTopMenuBarComponent {}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: '',
})
class MockCommandPaletteComponent {}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let mockAuthService: any;
  let mockScannerService: any;
  let mockRouter: any;
  let mockUi: any;

  beforeEach(async () => {
    mockAuthService = {
      isSyncing: signal(false),
    };
    mockScannerService = {
      openScanner: vi.fn().mockName('openScanner'),
      closeScanner: vi.fn().mockName('closeScanner'),
      showScanner: signal(false),
    };
    mockRouter = {
      url: '/collection',
      navigate: vi.fn().mockName('navigate'),
    };
    mockUi = {
      railExpanded: signal(false),
      paletteOpen: signal(false),
      moreOpen: signal(false),
      togglePalette: vi.fn().mockName('togglePalette'),
      closePalette: vi.fn().mockName('closePalette'),
      closeMore: vi.fn().mockName('closeMore'),
      toggleRail: vi.fn().mockName('toggleRail'),
    };

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ScannerService, useValue: mockScannerService },
        { provide: NavigationUiService, useValue: mockUi },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(LayoutComponent, {
        remove: {
          imports: [
            SidebarComponent,
            BottomNavComponent,
            TopMenuBarComponent,
            CommandPaletteComponent,
          ],
        },
        add: {
          imports: [
            MockSidebarComponent,
            MockBottomNavComponent,
            MockTopMenuBarComponent,
            MockCommandPaletteComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const keydown = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('pads the content for the collapsed rail', () => {
    expect(component.mainPadding()).toBe('md:pl-[88px]');

    mockUi.railExpanded.set(true);
    expect(component.mainPadding()).toBe('md:pl-[232px]');
  });

  it('caps the content width and offers a narrow variant for reading pages', () => {
    expect(component.contentClass()).toContain('max-w-[1560px]');

    fixture.componentRef.setInput('width', 'narrow');
    expect(component.contentClass()).toContain('max-w-4xl');
  });

  it('shows the primary scan button on phones', () => {
    const fab: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="scan-fab"]');
    expect(fab).toBeTruthy();
    expect(fab.className).toContain('md:hidden');
    expect(fab.getAttribute('aria-label')).toBeTruthy();
  });

  it('opens and closes the palette with ⌘K', () => {
    component.onKeydown(keydown({ key: 'k', metaKey: true }));
    expect(mockUi.togglePalette).toHaveBeenCalledTimes(1);

    component.onKeydown(keydown({ key: 'K', ctrlKey: true }));
    expect(mockUi.togglePalette).toHaveBeenCalledTimes(2);
  });

  it('toggles the rail with ⌘B and ignores plain keys', () => {
    component.onKeydown(keydown({ key: 'b', metaKey: true }));
    expect(mockUi.toggleRail).toHaveBeenCalledTimes(1);

    component.onKeydown(keydown({ key: 'b' }));
    component.onKeydown(keydown({ key: 'k' }));
    expect(mockUi.toggleRail).toHaveBeenCalledTimes(1);
    expect(mockUi.togglePalette).not.toHaveBeenCalled();
  });

  it('closes open overlays with Escape', () => {
    component.onKeydown(keydown({ key: 'Escape' }));

    expect(mockUi.closePalette).toHaveBeenCalled();
    expect(mockUi.closeMore).toHaveBeenCalled();
  });

  it('should handle scan by opening scanner and navigating if not on dashboard', () => {
    component.handleScan();
    expect(mockScannerService.openScanner).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should handle scan by opening scanner and NOT navigating if already on dashboard', () => {
    mockRouter.url = '/';
    mockRouter.navigate.mockClear();
    component.handleScan();
    expect(mockScannerService.openScanner).toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should handle scan by closing scanner if already open', () => {
    mockScannerService.showScanner.set(true);
    component.handleScan();
    expect(mockScannerService.closeScanner).toHaveBeenCalled();
  });
});
