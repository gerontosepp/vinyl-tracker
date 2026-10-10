import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { LocalizedDatePipe } from './localized-date.pipe';
import { LanguageService } from '../services/language.service';

describe('LocalizedDatePipe', () => {
  let pipe: LocalizedDatePipe;
  let languageService: LanguageService;

  beforeAll(() => {
    registerLocaleData(localeDe);
    registerLocaleData(localeEn);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LanguageService, LocalizedDatePipe],
    });
    languageService = TestBed.inject(LanguageService);
    pipe = TestBed.inject(LocalizedDatePipe);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should format date according to German locale (de)', () => {
    languageService.setLanguage('de');
    // Use an explicit date: Oct 8, 2026
    const testDate = new Date(2026, 9, 8, 12, 0, 0); // Month is 0-indexed (9 = Oct)
    const formatted = pipe.transform(testDate, 'mediumDate');
    expect(formatted).toBe('08.10.2026');
  });

  it('should format date according to English locale (en)', () => {
    languageService.setLanguage('en');
    const testDate = new Date(2026, 9, 8, 12, 0, 0);
    const formatted = pipe.transform(testDate, 'mediumDate');
    expect(formatted).toBe('Oct 8, 2026');
  });

  it('should format shortDate and medium according to active locale', () => {
    languageService.setLanguage('de');
    const testDate = new Date(2026, 9, 8, 12, 0, 0);
    expect(pipe.transform(testDate, 'shortDate')).toBe('08.10.26');

    languageService.setLanguage('en');
    expect(pipe.transform(testDate, 'shortDate')).toBe('10/8/26');
  });

  it('should handle null and undefined gracefully', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform('')).toBeNull();
  });

  it('should allow overriding locale explicitly', () => {
    languageService.setLanguage('en');
    const testDate = new Date(2026, 9, 8, 12, 0, 0);
    const formatted = pipe.transform(testDate, 'mediumDate', undefined, 'de');
    expect(formatted).toBe('08.10.2026');
  });
});
