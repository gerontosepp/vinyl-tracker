import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LayoutComponent } from './layout.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { BottomNavComponent } from './bottom-nav/bottom-nav.component';
import { TopMenuBarComponent } from './top-menu-bar/top-menu-bar.component';
import { AuthService } from '../../../core/services/auth.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { Router } from '@angular/router';
import { Component, signal, NO_ERRORS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  template: ''
})
class MockSidebarComponent {}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  template: ''
})
class MockBottomNavComponent {}

@Component({
  selector: 'app-top-menu-bar',
  standalone: true,
  template: ''
})
class MockTopMenuBarComponent {}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let mockAuthService: any;
  let mockScannerService: any;
  let mockRouter: any;

  beforeEach(async () => {
    mockAuthService = {
      isSyncing: signal(false)
    };
    mockScannerService = {
      openScanner: jasmine.createSpy('openScanner')
    };
    mockRouter = {
      url: '/collection',
      navigate: jasmine.createSpy('navigate')
    };

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ScannerService, useValue: mockScannerService },
        { provide: Router, useValue: mockRouter }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .overrideComponent(LayoutComponent, {
      remove: {
        imports: [SidebarComponent, BottomNavComponent, TopMenuBarComponent]
      },
      add: {
        imports: [MockSidebarComponent, MockBottomNavComponent, MockTopMenuBarComponent]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle scan by opening scanner and navigating if not on dashboard', () => {
    component.handleScan();
    expect(mockScannerService.openScanner).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should handle scan by opening scanner and NOT navigating if already on dashboard', () => {
    mockRouter.url = '/';
    mockRouter.navigate.calls.reset();
    component.handleScan();
    expect(mockScannerService.openScanner).toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
