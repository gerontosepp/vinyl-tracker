import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { ScannerService } from '../../core/services/scanner.service';
import { LanguageService } from '../../core/services/language.service';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { AnalyticsTopRecord, CollectionValueResponse, GenreBreakdownItem, ListenEvent } from '../../core/types';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: any;
  let mockApiService: any;
  let mockToastService: any;
  let mockScannerService: any;
  let mockLanguageService: any;

  const mockListens: ListenEvent[] = [
    {
      id: 1,
      timestamp: '2026-10-07T12:00:00Z',
      record: {
        discogsId: 101,
        title: 'Dark Side of the Moon',
        artist: 'Pink Floyd',
        thumbUrl: '',
      },
    },
  ];

  const mockTops: AnalyticsTopRecord[] = [
    {
      recordTitle: 'Dark Side of the Moon',
      title: 'Dark Side of the Moon',
      artist: 'Pink Floyd',
      thumbUrl: '',
      count: 5,
    },
  ];

  const mockValue: CollectionValueResponse = {
    minimum: { currency: 'EUR', value: 100 },
    median: { currency: 'EUR', value: 200 },
    maximum: { currency: 'EUR', value: 500 },
  };

  const mockGenres: GenreBreakdownItem[] = [
    { name: 'Rock', value: 10 },
    { name: 'Jazz', value: 5 },
  ];

  beforeEach(async () => {
    mockAuthService = {
      user: signal({
        id: 1,
        username: 'testuser',
      }),
      isSyncing: signal(false),
      logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
    };

    mockApiService = {
      getRecentListens: jasmine.createSpy('getRecentListens').and.returnValue(of(mockListens)),
      getTopRecords: jasmine.createSpy('getTopRecords').and.returnValue(of(mockTops)),
      getCollectionValue: jasmine.createSpy('getCollectionValue').and.returnValue(of(mockValue)),
      getGenreBreakdown: jasmine.createSpy('getGenreBreakdown').and.returnValue(of(mockGenres)),
      getCollection: jasmine.createSpy('getCollection').and.returnValue(
        of({ releases: [], pagination: { total: 0, items: 0, pages: 1, page: 1, per_page: 1 } })
      ),
      deleteScan: jasmine.createSpy('deleteScan').and.returnValue(of(void 0)),
    };

    mockToastService = {
      showToast: jasmine.createSpy('showToast'),
    };

    mockScannerService = {
      scanLogged: signal(0),
      showScanner: signal(false),
      closeScanner: jasmine.createSpy('closeScanner'),
    };

    mockLanguageService = {
      language: signal('en'),
      translate: jasmine.createSpy('translate').and.callFake((key: string) => {
        const dict: Record<string, string> = {
          'dashboard.all': 'All',
          'dashboard.days7': '7 Days',
          'dashboard.today': 'Today',
          'dashboard.other': 'Other',
        };
        return dict[key] || key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: ScannerService, useValue: mockScannerService },
        { provide: LanguageService, useValue: mockLanguageService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and initialize with default 7-day range', () => {
    expect(component).toBeTruthy();
    expect(component.startDate()).toBe(component.sevenDaysAgoString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(
      component.sevenDaysAgoString,
      component.todayString
    );
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(
      component.sevenDaysAgoString,
      component.todayString
    );
    expect(component.recentListens()).toEqual(mockListens);
    expect(component.topRecords()).toEqual(mockTops);
    expect(component.collectionValue()).toEqual(mockValue);
    expect(component.genreData()).toEqual(mockGenres);
  });

  it('should filter by today when setFilterToday is called', () => {
    mockApiService.getRecentListens.calls.reset();
    mockApiService.getTopRecords.calls.reset();

    component.setFilterToday();

    expect(component.startDate()).toBe(component.todayString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(
      component.todayString,
      component.todayString
    );
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(
      component.todayString,
      component.todayString
    );
  });

  it('should filter by last 7 days when setFilterSevenDays is called', () => {
    // First change to today
    component.setFilterToday();
    mockApiService.getRecentListens.calls.reset();
    mockApiService.getTopRecords.calls.reset();

    component.setFilterSevenDays();

    expect(component.startDate()).toBe(component.sevenDaysAgoString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(
      component.sevenDaysAgoString,
      component.todayString
    );
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(
      component.sevenDaysAgoString,
      component.todayString
    );
  });

  it('should reset filter when setFilterAll is called', () => {
    mockApiService.getRecentListens.calls.reset();
    mockApiService.getTopRecords.calls.reset();

    component.setFilterAll();

    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('', '');
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith('', '');
  });

  it('should update dates when onStartDateChange or onEndDateChange is called', () => {
    mockApiService.getRecentListens.calls.reset();
    component.onStartDateChange('2026-10-01');
    expect(component.startDate()).toBe('2026-10-01');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('2026-10-01', component.todayString);

    mockApiService.getRecentListens.calls.reset();
    component.onEndDateChange('2026-10-05');
    expect(component.endDate()).toBe('2026-10-05');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('2026-10-01', '2026-10-05');
  });

  it('should delete a scan when confirmed', async () => {
    spyOn(window, 'confirm').and.returnValue(true);

    await component.handleDelete(1);

    expect(mockApiService.deleteScan).toHaveBeenCalledWith(1);
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Scan deleted successfully',
      'success'
    );
    expect(component.recentListens().length).toBe(0);
  });

  it('should not delete a scan when cancelled in confirmation', async () => {
    spyOn(window, 'confirm').and.returnValue(false);

    await component.handleDelete(1);

    expect(mockApiService.deleteScan).not.toHaveBeenCalled();
    expect(component.recentListens().length).toBe(1);
  });

  it('should handle delete error gracefully', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockApiService.deleteScan.and.returnValue(throwError(() => new Error('Delete failed')));

    await component.handleDelete(1);

    expect(mockToastService.showToast).toHaveBeenCalledWith('Failed to delete scan', 'error');
  });

  it('should calculate conic gradient correctly', () => {
    const gradient = component.getConicGradient();
    expect(gradient).toContain('conic-gradient(');

    component.genreData.set([]);
    expect(component.getConicGradient()).toBe('#cbd5e1');
  });

  it('should render all genres in the legend without truncation', () => {
    const sixGenres: GenreBreakdownItem[] = [
      { name: 'Rock', value: 50 },
      { name: 'Pop', value: 30 },
      { name: 'Electronic', value: 20 },
      { name: 'Jazz', value: 15 },
      { name: 'Classical', value: 10 },
      { name: 'Other', value: 40 },
    ];
    component.genreData.set(sixGenres);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const legendText = compiled.textContent || '';

    // Verify all 6 genres are rendered in the DOM
    expect(legendText).toContain('Rock');
    expect(legendText).toContain('Pop');
    expect(legendText).toContain('Electronic');
    expect(legendText).toContain('Jazz');
    expect(legendText).toContain('Classical');
    expect(legendText).toContain('Other');
  });

  it('should compute chartSlices with top 5 and aggregated Other', () => {
    const genres: GenreBreakdownItem[] = [
      { name: 'Rock', value: 50 },
      { name: 'Pop', value: 30 },
      { name: 'Electronic', value: 20 },
      { name: 'Jazz', value: 15 },
      { name: 'Classical', value: 10 },
      { name: 'Reggae', value: 8 },
      { name: 'Metal', value: 5 },
    ];
    component.genreData.set(genres);
    const slices = component.chartSlices();
    expect(slices.length).toBe(6);
    expect(slices[0]).toEqual({ name: 'Rock', value: 50 });
    expect(slices[4]).toEqual({ name: 'Classical', value: 10 });
    expect(slices[5]).toEqual({ name: 'Other', value: 13 });
  });

  it('should return correct genre colors for top items and others', () => {
    expect(component.getGenreColor(0)).toBe(component.GENRE_COLORS[0]);
    expect(component.getGenreColor(4)).toBe(component.GENRE_COLORS[4]);
    expect(component.getGenreColor(5)).toBe(component.GENRE_COLORS[5]);
    expect(component.getGenreColor(10)).toBe(component.GENRE_COLORS[5]);
  });
});
