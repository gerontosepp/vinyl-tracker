import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created and default to German or localStorage value', () => {
    expect(service).toBeTruthy();
    expect(['de', 'en']).toContain(service.language());
  });

  it('should allow setting language to English', () => {
    service.setLanguage('en');
    expect(service.language()).toBe('en');
    expect(service.translate('nav.home')).toBe('Home');
  });

  it('should allow setting language back to German', () => {
    service.setLanguage('en');
    service.setLanguage('de');
    expect(service.language()).toBe('de');
    expect(service.translate('nav.home')).toBe('Start');
  });

  it('should interpolate variables in translation keys', () => {
    service.setLanguage('de');
    const result = service.translate('collection.selectedQr', { count: 5 });
    expect(result).toBe('Ausgewählte QR-Codes (5)');
  });

  it('should fallback to key if translation is missing', () => {
    expect(service.translate('unknown.key')).toBe('unknown.key');
  });
});
