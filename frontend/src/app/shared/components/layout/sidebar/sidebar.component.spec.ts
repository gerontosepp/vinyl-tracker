import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar.component';
import { ScannerService } from '../../../../core/services/scanner.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let mockScannerService: any;

  beforeEach(async () => {
    mockScannerService = {
      showScanner: signal(false),
      closeScanner: jasmine.createSpy('closeScanner'),
    };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: ScannerService, useValue: mockScannerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit scanClick output when scan button is clicked', () => {
    spyOn(component.scanClick, 'emit');

    const scanButton = fixture.nativeElement.querySelector('button[aria-label="Scannen"], button[aria-label="Scan"]');
    expect(scanButton).toBeTruthy();

    scanButton.click();
    expect(component.scanClick.emit).toHaveBeenCalled();
  });

  it('should apply active styling when showScanner is true', () => {
    mockScannerService.showScanner.set(true);
    fixture.detectChanges();

    const scanButton = fixture.nativeElement.querySelector('button[aria-label="Scannen"], button[aria-label="Scan"]');
    expect(scanButton.className).toContain('text-indigo-600');
    expect(scanButton.className).toContain('font-bold');
  });

  it('should apply standard styling when showScanner is false', () => {
    mockScannerService.showScanner.set(false);
    fixture.detectChanges();

    const scanButton = fixture.nativeElement.querySelector('button[aria-label="Scannen"], button[aria-label="Scan"]');
    expect(scanButton.className).toContain('text-slate-400');
    expect(scanButton.className).toContain('font-medium');
  });
});
