import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { LanguageService } from '../services/language.service';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let languageService: LanguageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LanguageService, TranslatePipe],
    });
    languageService = TestBed.inject(LanguageService);
    pipe = TestBed.inject(TranslatePipe);
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should transform translation keys correctly', () => {
    languageService.setLanguage('de');
    expect(pipe.transform('nav.home')).toBe('Start');

    languageService.setLanguage('en');
    expect(pipe.transform('nav.home')).toBe('Home');
  });

  it('should handle missing keys gracefully', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('missing.key')).toBe('missing.key');
  });
});
