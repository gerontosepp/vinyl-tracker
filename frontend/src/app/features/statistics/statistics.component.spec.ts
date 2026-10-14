import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatisticsComponent } from './statistics.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { provideRouter } from '@angular/router';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { CollectionValueResponse } from '../../core/types';

describe('StatisticsComponent', () => {
  let component: StatisticsComponent;
  let fixture: ComponentFixture<StatisticsComponent>;

  const mockValue: CollectionValueResponse = {
    minimum: { currency: 'EUR', value: 6405 },
    median: { currency: 'EUR', value: 11973.16 },
    maximum: { currency: 'EUR', value: 23112 },
  };

  const mockAuthService = {
    user: signal({ id: 1, username: 'testuser' }),
    isSyncing: signal(false),
    logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
  };

  const mockApiService = {
    getCollectionValue: jasmine.createSpy('getCollectionValue').and.returnValue(of(mockValue)),
    getGenreBreakdown: jasmine.createSpy('getGenreBreakdown').and.returnValue(of([])),
  };

  const mockToastService = {
    showToast: jasmine.createSpy('showToast'),
  };

  const mockLanguageService = {
    language: signal('en'),
    translate: jasmine.createSpy('translate').and.callFake((key: string) => key),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LanguageService, useValue: mockLanguageService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StatisticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load collection value', () => {
    expect(component).toBeTruthy();
    expect(component.collectionValue()).toEqual(mockValue);
  });

  it('should return correct currency symbols with Euro default', () => {
    expect(component.getCurrencySymbol('EUR')).toBe('€');
    expect(component.getCurrencySymbol('€')).toBe('€');
    expect(component.getCurrencySymbol('USD')).toBe('$');
    expect(component.getCurrencySymbol('$')).toBe('$');
    expect(component.getCurrencySymbol(undefined)).toBe('€');
  });

  it('should render collection value and min/max with Euro symbol', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent || '';
    expect(text).toContain('€');
    expect(text).toContain('Min:');
    expect(text).toContain('Max:');
    expect(text).toContain('6,405 €');
    expect(text).toContain('23,112 €');
  });
});
