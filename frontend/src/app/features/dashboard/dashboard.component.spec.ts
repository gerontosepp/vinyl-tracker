import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { ScannerService } from '../../core/services/scanner.service';
import { AppResumeService } from '../../core/services/app-resume.service';
import { LanguageService } from '../../core/services/language.service';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { AnalyticsTopRecord, CollectionValueResponse, GenreBreakdownItem, ListenEvent } from '../../core/types';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockAuthService: any;
  let mockApiService: any;
  let mockToastService: any;
  let mockScannerService: any;
  const resumed = new Subject<void>();
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
      logout: vi.fn().mockName('logout').mockResolvedValue(undefined),
    };

    mockApiService = {
      getRecentListens: vi.fn().mockName('getRecentListens').mockReturnValue(of(mockListens)),
      getTopRecords: vi.fn().mockName('getTopRecords').mockReturnValue(of(mockTops)),
      getTopArtists: vi.fn().mockName('getTopArtists').mockReturnValue(of([{ artist: 'Miles Davis', count: 9, recordCount: 2, thumbUrls: [] }])),
      getCollectionValue: vi.fn().mockName('getCollectionValue').mockReturnValue(of(mockValue)),
      getGenreBreakdown: vi.fn().mockName('getGenreBreakdown').mockReturnValue(of(mockGenres)),
      getCollection: vi.fn().mockName('getCollection').mockReturnValue(of({ releases: [], pagination: { total: 0, items: 0, pages: 1, page: 1, per_page: 1 } })),
      deleteScan: vi.fn().mockName('deleteScan').mockReturnValue(of(void 0)),
    };

    mockToastService = {
      showToast: vi.fn().mockName('showToast'),
    };

    mockScannerService = {
      scanLogged: signal(0),
      showScanner: signal(false),
      closeScanner: vi.fn().mockName('closeScanner'),
    };

    mockLanguageService = {
      language: signal('en'),
      translate: vi.fn().mockName('translate').mockImplementation((key: string) => {
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
        { provide: AppResumeService, useValue: { resumed$: resumed } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reloads the statistics when the app returns from the background', () => {
    const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => undefined);
    resumed.next();
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('loads the top artists with the period and opens the collection searched for an artist', () => {
    expect(mockApiService.getTopArtists).toHaveBeenCalledWith(component.sevenDaysAgoString, component.todayString);
    expect(component.topArtists()[0].artist).toBe('Miles Davis');

    mockApiService.getTopArtists.mockClear();
    component.setFilterToday();
    expect(mockApiService.getTopArtists).toHaveBeenCalledWith(component.todayString, component.todayString);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.openArtist(component.topArtists()[0]);
    expect(navigate).toHaveBeenCalledWith(['/collection'], { queryParams: { search: 'Miles Davis' } });
  });

  it('shows no top artists if they cannot be loaded', () => {
    mockApiService.getTopArtists.mockReturnValue(throwError(() => new Error('down')));
    component.loadData();
    expect(component.topArtists()).toEqual([]);
    expect(component.topRecords().length).toBeGreaterThan(0);
  });

  it('should create and initialize with default 7-day range', () => {
    expect(component).toBeTruthy();
    expect(component.startDate()).toBe(component.sevenDaysAgoString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(component.sevenDaysAgoString, component.todayString);
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(component.sevenDaysAgoString, component.todayString);
    expect(component.recentListens()).toEqual(mockListens);
    expect(component.topRecords()).toEqual(mockTops);
    expect(component.collectionValue()).toEqual(mockValue);
    expect(component.genreData()).toEqual(mockGenres);
  });

  it('should filter by today when setFilterToday is called', () => {
    mockApiService.getRecentListens.mockClear();
    mockApiService.getTopRecords.mockClear();

    component.setFilterToday();

    expect(component.startDate()).toBe(component.todayString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(component.todayString, component.todayString);
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(component.todayString, component.todayString);
  });

  it('should filter by last 7 days when setFilterSevenDays is called', () => {
    // First change to today
    component.setFilterToday();
    mockApiService.getRecentListens.mockClear();
    mockApiService.getTopRecords.mockClear();

    component.setFilterSevenDays();

    expect(component.startDate()).toBe(component.sevenDaysAgoString);
    expect(component.endDate()).toBe(component.todayString);
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith(component.sevenDaysAgoString, component.todayString);
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith(component.sevenDaysAgoString, component.todayString);
  });

  it('should reset filter when setFilterAll is called', () => {
    mockApiService.getRecentListens.mockClear();
    mockApiService.getTopRecords.mockClear();

    component.setFilterAll();

    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('', '');
    expect(mockApiService.getTopRecords).toHaveBeenCalledWith('', '');
  });

  it('should update dates when onStartDateChange or onEndDateChange is called', () => {
    mockApiService.getRecentListens.mockClear();
    component.onStartDateChange('2026-10-01');
    expect(component.startDate()).toBe('2026-10-01');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('2026-10-01', component.todayString);

    mockApiService.getRecentListens.mockClear();
    component.onEndDateChange('2026-10-05');
    expect(component.endDate()).toBe('2026-10-05');
    expect(mockApiService.getRecentListens).toHaveBeenCalledWith('2026-10-01', '2026-10-05');
  });

  it('should delete a scan when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.handleDelete(1);

    expect(mockApiService.deleteScan).toHaveBeenCalledWith(1);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Scan deleted successfully', 'success');
    expect(component.recentListens().length).toBe(0);
  });

  it('should not delete a scan when cancelled in confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.handleDelete(1);

    expect(mockApiService.deleteScan).not.toHaveBeenCalled();
    expect(component.recentListens().length).toBe(1);
  });

  it('should handle delete error gracefully', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApiService.deleteScan.mockReturnValue(throwError(() => new Error('Delete failed')));

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

  it('should return correct currency symbols with Euro default', () => {
    expect(component.getCurrencySymbol('EUR')).toBe('€');
    expect(component.getCurrencySymbol('€')).toBe('€');
    expect(component.getCurrencySymbol('USD')).toBe('$');
    expect(component.getCurrencySymbol('$')).toBe('$');
    expect(component.getCurrencySymbol(undefined)).toBe('€');
  });

  it('should render collection value with Euro symbol in median and min/max subtext', () => {
    component.collectionValue.set({
      minimum: { currency: 'EUR', value: 6405 },
      median: { currency: 'EUR', value: 11973.16 },
      maximum: { currency: 'EUR', value: 23112 },
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent || '';
    expect(text).toContain('€');
    expect(text).toContain('Min:');
    expect(text).toContain('Max:');
    expect(text).toContain('6,405 €');
    expect(text).toContain('23,112 €');
  });

  describe('record detail view', () => {
    const detail = {
      id: 7,
      discogs_id: 101,
      title: 'Dark Side of the Moon',
      artist: 'Pink Floyd',
      genres: [],
      in_collection: true,
      listen_count: 5,
      tracklist: [],
      formats: [],
      labels: [],
    };

    beforeEach(() => {
      mockApiService.getRecordDetails = vi.fn().mockReturnValue(of(detail));
    });

    it('opens from "Zuletzt gehört" and loads the details', () => {
      component.openRecord(mockListens[0].record);

      expect(mockApiService.getRecordDetails).toHaveBeenCalledWith(101);
      expect(component.selectedRecord()?.id).toBe(101);
      expect(component.selectedRecord()?.basic_information.title).toBe('Dark Side of the Moon');
      expect(component.selectedRecord()?.basic_information.artists).toEqual([{ name: 'Pink Floyd' }]);
      expect(component.recordDetail()).toEqual(detail);
      expect(component.loadingDetail()).toBe(false);
    });

    it('is wired to both dashboard lists and renders the modal', () => {
      const recent = fixture.debugElement.query((el) => el.name === 'app-recent-listens');
      recent.triggerEventHandler('openRecord', mockListens[0].record);
      fixture.detectChanges();
      expect(mockApiService.getRecordDetails).toHaveBeenCalledWith(101);
      expect(fixture.debugElement.query((el) => el.name === 'app-record-detail-modal')).not.toBeNull();

      const top = fixture.debugElement.query((el) => el.name === 'app-top-records');
      top.triggerEventHandler('openRecord', { ...mockTops[0], discogsId: 202 });
      expect(mockApiService.getRecordDetails).toHaveBeenCalledWith(202);
    });

    it('opens from "Meistgespielte Alben" only with a Discogs ID', () => {
      component.openTopRecord(mockTops[0]);
      expect(mockApiService.getRecordDetails).not.toHaveBeenCalled();

      component.openTopRecord({ ...mockTops[0], title: '', discogsId: 202 });
      expect(mockApiService.getRecordDetails).toHaveBeenCalledWith(202);
      // Falls back to recordTitle
      expect(component.selectedRecord()?.basic_information.title).toBe('Dark Side of the Moon');
    });

    it('shows an error toast if the details cannot be loaded', () => {
      mockApiService.getRecordDetails.mockReturnValue(throwError(() => new Error('Not found')));

      component.openRecord(mockListens[0].record);

      expect(component.loadingDetail()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith('Not found', 'error');
    });

    it('closes without reloading if nothing changed', () => {
      component.openRecord(mockListens[0].record);
      mockApiService.getRecentListens.mockClear();

      component.closeDetail();

      expect(component.selectedRecord()).toBeNull();
      expect(component.recordDetail()).toBeNull();
      expect(mockApiService.getRecentListens).not.toHaveBeenCalled();
    });

    it('refreshes the lists on close after a logged listen or condition change', () => {
      component.openRecord(mockListens[0].record);
      mockApiService.getRecentListens.mockClear();
      mockApiService.getTopRecords.mockClear();

      component.onDetailChanged({ ...detail, listen_count: 6 });
      expect(component.recordDetail()?.listen_count).toBe(6);
      expect(mockApiService.getRecentListens).not.toHaveBeenCalled();

      component.closeDetail();
      expect(mockApiService.getRecentListens).toHaveBeenCalledTimes(1);
      expect(mockApiService.getTopRecords).toHaveBeenCalledTimes(1);

      // A second close does not reload again
      component.closeDetail();
      expect(mockApiService.getRecentListens).toHaveBeenCalledTimes(1);
    });

    it('closes and refreshes after the record was removed', () => {
      component.openRecord(mockListens[0].record);
      mockApiService.getRecentListens.mockClear();

      component.onRecordRemoved();

      expect(component.selectedRecord()).toBeNull();
      expect(mockApiService.getRecentListens).toHaveBeenCalledTimes(1);
    });
  });
});
