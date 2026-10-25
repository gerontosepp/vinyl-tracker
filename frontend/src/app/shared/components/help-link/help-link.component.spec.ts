import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HelpLinkComponent } from './help-link.component';
import { ScannerService } from '../../../core/services/scanner.service';
import { LanguageService } from '../../../core/services/language.service';

describe('HelpLinkComponent', () => {
  let fixture: ComponentFixture<HelpLinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpLinkComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    fixture = TestBed.createComponent(HelpLinkComponent);
    fixture.componentRef.setInput('anchor', 'regale');
    fixture.detectChanges();
  });

  it('opens the help page at the section of the current page', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="help-link"]');
    expect(link.getAttribute('href')).toBe('/help#regale');
    expect(link.getAttribute('aria-label')).toBe('Hilfe zu dieser Seite');
  });

  it('closes the scanner overlay when opening the help', () => {
    const scanner = TestBed.inject(ScannerService);
    scanner.openScanner();
    fixture.nativeElement.querySelector('[data-testid="help-link"]').click();
    expect(scanner.showScanner()).toBe(false);
  });
});
