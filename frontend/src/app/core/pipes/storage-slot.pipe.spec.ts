import { TestBed } from '@angular/core/testing';
import { StorageSlotPipe } from './storage-slot.pipe';
import { LanguageService } from '../services/language.service';
import { StorageSlot } from '../types';

describe('StorageSlotPipe', () => {
  let pipe: StorageSlotPipe;
  let language: LanguageService;

  const slot: StorageSlot = {
    unitId: 1,
    unitName: 'Kallax-1',
    compartment: 3,
    row: 1,
    column: 3,
    oversized: false,
    unplaced: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [StorageSlotPipe] });
    pipe = TestBed.inject(StorageSlotPipe);
    language = TestBed.inject(LanguageService);
    language.setLanguage('de');
  });

  it('formats a slot in the current language', () => {
    expect(pipe.transform(slot)).toBe('Kallax-1 · Fach 3');
    expect(pipe.transform(slot, true)).toBe('Kallax-1 · 3');
    language.setLanguage('en');
    expect(pipe.transform(slot)).toBe('Kallax-1 · compartment 3');
  });

  it('marks copies without space and ignores missing slots', () => {
    expect(pipe.transform({ ...slot, unitName: null, compartment: null, unplaced: true })).toBe('Ohne Platz');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(null)).toBe('');
  });
});
