import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CollectionComponent } from './collection.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { of, Subject } from 'rxjs';
import { AppResumeService } from '../../core/services/app-resume.service';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CollectionRelease } from '../../core/types';

describe('CollectionComponent', () => {
  let component: CollectionComponent;
  let fixture: ComponentFixture<CollectionComponent>;
  let mockApiService: any;
  let mockAuthService: any;
  let mockToastService: any;
  const resumed = new Subject<void>();

  beforeEach(async () => {
    mockApiService = {
      getCollection: vi.fn().mockName('getCollection').mockReturnValue(of({ releases: [], pagination: { page: 1, pages: 1, per_page: 50, items: 0, urls: {} } })),
      getGenreBreakdown: vi.fn().mockName('getGenreBreakdown').mockReturnValue(of([{ name: 'Rock', value: 10 }])),
      getProxiedImageUrl: vi.fn().mockName('getProxiedImageUrl').mockImplementation((url: string) => url),
      exportCollection: vi.fn().mockName('exportCollection').mockReturnValue(of(new Blob(['csv'], { type: 'text/csv' }))),
      getStorageLayout: vi.fn().mockName('getStorageLayout').mockReturnValue(of({ media: [] })),
    };
    mockAuthService = {
      isSyncing: signal(false)
    };
    mockToastService = {
      showToast: vi.fn().mockName('showToast')
    };

    await TestBed.configureTestingModule({
      imports: [CollectionComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AppResumeService, useValue: { resumed$: resumed } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reloads records and shelves when the app returns from the background', () => {
    const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => undefined);
    const loadShelves = vi.spyOn(component, 'loadShelves').mockImplementation(() => undefined);

    resumed.next();

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadShelves).toHaveBeenCalledTimes(1);
  });

  it('takes the search from the URL, e.g. from the dashboard top artists', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CollectionComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: { ...mockAuthService, user: signal({ id: 1 }) } },
        { provide: ToastService, useValue: mockToastService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ search: ' Miles Davis ' }) } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const searched = TestBed.createComponent(CollectionComponent).componentInstance;
    searched.ngOnInit();

    expect(searched.search()).toBe('Miles Davis');
    expect(searched.printFilter().search).toBe('Miles Davis');
    expect(mockApiService.getCollection).toHaveBeenLastCalledWith(
      1, 50, 0, 'artist', 'asc', 'Miles Davis', 'all', [], '', undefined, false, {}
    );
  });

  it('switches between list and shelves and reloads the list when coming back', () => {
    const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => {});
    expect(component.view()).toBe('list');

    component.switchView('shelves');
    expect(component.view()).toBe('shelves');
    expect(loadData).not.toHaveBeenCalled();

    component.switchView('shelves');
    component.switchView('list');
    expect(component.view()).toBe('list');
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  describe('storage filter', () => {
    const layout = {
      media: [
        {
          media: 'vinyl',
          unplacedCount: 0,
          units: [{ id: 3, name: 'Kallax-1', typeName: 'Kallax', rows: 1, columns: 2, compartments: [{}, {}] }],
        },
      ],
    };

    it('loads the shelves for the toolbar', () => {
      mockApiService.getStorageLayout.mockReturnValue(of(layout));
      component.loadShelves();
      expect(component.storageShelves()).toEqual([{ id: 3, name: 'Kallax-1', compartments: 2 }]);
    });

    it('filters the list and the print scope by shelf and compartment', () => {
      mockAuthService.user = signal(null);
      component.onStorageFilterChange('3:2');
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).not.toHaveBeenCalled(); // no user signed in
      expect(component.printFilter()).toEqual({ sort: 'artist', sort_order: 'asc', storage_unit: '3', compartment: 2 });

      component.onStorageFilterChange('unplaced');
      expect(component.printFilter().storage_unit).toBe('unplaced');
      expect(component.printFilter().compartment).toBeUndefined();

      component.clearAllFilters();
      expect(component.storageFilter()).toBe('');
    });

    it('passes the storage filter to the collection request', () => {
      mockAuthService.user = signal({ id: 1 });
      component.onStorageFilterChange('3');
      expect(mockApiService.getCollection).toHaveBeenLastCalledWith(
        1, component.perPage(), 0, 'artist', 'asc', '', 'all', [], '', undefined, false, { storage_unit: '3' }
      );
    });

    it('filters list and print scope by source and resets it with all filters', () => {
      mockAuthService.user = signal({ id: 1 });
      component.onSourceChange('manual');
      expect(mockApiService.getCollection).toHaveBeenLastCalledWith(
        1, component.perPage(), 0, 'artist', 'asc', '', 'all', [], '', undefined, false, { source: 'manual' }
      );
      expect(component.printFilter().source).toBe('manual');

      component.clearAllFilters();
      expect(component.source()).toBe('');
      expect(component.printFilter().source).toBeUndefined();
    });

    it('reloads the list and updates the open record after a manual record was saved', () => {
      mockAuthService.user = signal({ id: 1 });
      component.selectedRecord.set({ id: -3, basic_information: { id: -3, title: 'Alt', artists: [] } } as any);
      component.recordDetail.set({ discogs_id: -3 } as any);
      mockApiService.getCollection.mockClear();

      component.onManualSaved({ discogs_id: -3, title: 'Neu', artist: 'Die Sterne', thumb_url: '/api/covers/u?v=2' } as any);

      expect(component.recordDetail()?.title).toBe('Neu');
      expect(component.selectedRecord()?.basic_information.title).toBe('Neu');
      expect(component.selectedRecord()?.basic_information.thumb).toBe('/api/covers/u?v=2');
      expect(mockApiService.getCollection).toHaveBeenCalled();
    });

    it('loads the details of the opened copy', () => {
      mockApiService.getRecordDetails = vi.fn().mockReturnValue(of({ discogs_id: 1001, instance_id: 556 }));
      component.openDetail({ id: 1001, instance_id: 556, basic_information: { id: 1001, title: 'Posen', artists: [] } } as any);

      expect(mockApiService.getRecordDetails).toHaveBeenCalledWith(1001, 556);
      expect(component.recordDetail()?.instance_id).toBe(556);
      expect(component.loadingDetail()).toBe(false);
    });

    it('shows a taken-over record under its Discogs IDs and reloads the list', () => {
      mockAuthService.user = signal({ id: 1 });
      component.selectedRecord.set({
        id: -3,
        instance_id: -3,
        source: 'manual',
        basic_information: { id: -3, title: 'Posen', artists: [], thumb: '/api/covers/u' },
      } as any);
      mockApiService.getCollection.mockClear();
      const record = { discogs_id: 1001, title: 'Posen', artist: 'Die Sterne', thumb_url: 'https://i.discogs.com/1001.jpg' } as any;

      component.onTakenOver({ record, instanceId: 555, mode: 'new_copy' });

      expect(component.recordDetail()).toBe(record);
      const selected = component.selectedRecord()!;
      expect(selected.id).toBe(1001);
      expect(selected.instance_id).toBe(555);
      expect(selected.source).toBe('discogs');
      expect(selected.basic_information.thumb).toBe('https://i.discogs.com/1001.jpg');
      expect(selected.basic_information.artists).toEqual([{ name: 'Die Sterne' }]);
      expect(mockApiService.getCollection).toHaveBeenCalled();
    });

    it('opens the list filtered to a compartment clicked in the shelf view', () => {
      mockApiService.getStorageLayout.mockReturnValue(of(layout));
      const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => {});
      component.switchView('shelves');
      component.page.set(4);

      component.openStorageFilter('3:1');
      expect(component.view()).toBe('list');
      expect(component.storageFilter()).toBe('3:1');
      expect(component.page()).toBe(1);
      expect(mockApiService.getStorageLayout).toHaveBeenCalled();
      expect(loadData).toHaveBeenCalledTimes(1);
    });

    it('drops the filter of a deleted shelf', () => {
      const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => {});
      component.storageFilter.set('9:1');
      mockApiService.getStorageLayout.mockReturnValue(of(layout));
      component.loadShelves();
      expect(component.storageFilter()).toBe('');
      expect(loadData).toHaveBeenCalled();

      component.storageFilter.set('unplaced');
      component.loadShelves();
      expect(component.storageFilter()).toBe('unplaced');
    });
  });

  describe('getFormatType', () => {
    it('should return cd when format string contains cd', () => {
      const release = {
        id: 1,
        instance_id: 1,
        date_added: '',
        rating: 0,
        basic_information: {
          id: 1,
          title: 'Test Album',
          year: 2000,
          thumb: '',
          cover_image: '',
          artists: [],
          format: 'CD'
        }
      } as CollectionRelease;

      expect(component.getFormatType(release)).toBe('cd');
    });

    it('should return double_cd when format string indicates double cd', () => {
      const release = {
        id: 5,
        instance_id: 5,
        date_added: '',
        rating: 0,
        basic_information: {
          id: 5,
          title: 'Double CD Album',
          year: 2005,
          thumb: '',
          cover_image: '',
          artists: [],
          format: 'Double CD',
        },
      } as CollectionRelease;

      expect(component.getFormatType(release)).toBe('double_cd');
    });

    it('should return double_lp when format string indicates double lp', () => {
      const release = {
        id: 2,
        instance_id: 2,
        date_added: '',
        rating: 0,
        basic_information: {
          id: 2,
          title: 'Double Album',
          year: 1980,
          thumb: '',
          cover_image: '',
          artists: [],
          format: 'Double LP'
        }
      } as CollectionRelease;

      expect(component.getFormatType(release)).toBe('double_lp');
    });

    it('should return double_lp when formats list has qty >= 2 and vinyl', () => {
      const release = {
        id: 3,
        instance_id: 3,
        date_added: '',
        rating: 0,
        basic_information: {
          id: 3,
          title: 'Double Vinyl',
          year: 1975,
          thumb: '',
          cover_image: '',
          artists: [],
          formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] }]
        }
      } as CollectionRelease;

      expect(component.getFormatType(release)).toBe('double_lp');
    });

    it('should return lp as default for standard vinyl', () => {
      const release = {
        id: 4,
        instance_id: 4,
        date_added: '',
        rating: 0,
        basic_information: {
          id: 4,
          title: 'Single LP',
          year: 1969,
          thumb: '',
          cover_image: '',
          artists: [],
          format: 'LP'
        }
      } as CollectionRelease;

      expect(component.getFormatType(release)).toBe('lp');
    });
  });

  describe('onSortChange', () => {
    it('should set sort to format and sortOrder to asc', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.onSortChange('format');
      expect(component.sort()).toBe('format');
      expect(component.sortOrder()).toBe('asc');
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'format', 'asc', '', 'all', [], '', undefined, false, {});
    });
  });

  describe('onCategoryChange', () => {
    it('should update category, reset page to 1, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.page.set(3);
      component.onCategoryChange('cd');
      expect(component.category()).toBe('cd');
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'artist', 'asc', '', 'cd', [], '', undefined, false, {});
    });

    it('should ignore category change if already selected', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      mockApiService.getCollection.mockClear();
      component.onCategoryChange('all');
      expect(mockApiService.getCollection).not.toHaveBeenCalled();
    });

    it('should set totalItems from pagination items on loadData', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      mockApiService.getCollection.mockReturnValue(of({
        releases: [],
        pagination: { page: 1, pages: 13, per_page: 50, items: 603, urls: {} }
      }));
      component.loadData();
      expect(component.totalItems()).toBe(603);
    });
  });

  describe('onGenresChange and onYearsChange', () => {
    it('should update selectedGenres, reset page, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.page.set(2);
      component.onGenresChange(['Rock', 'Jazz']);
      expect(component.selectedGenres()).toEqual(['Rock', 'Jazz']);
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'artist', 'asc', '', 'all', ['Rock', 'Jazz'], '', undefined, false, {});
    });

    it('should reset all filters on clearAllFilters', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.selectedGenres.set(['Rock']);
      component.years.set('1970-1972');
      component.debouncedYears.set('1970-1972');
      component.search.set('Pink');
      component.debouncedSearch.set('Pink');
      component.category.set('cd');
      component.showPlayedOnly.set(true);
      component.notPlayedSince.set('2025-01-01');
      component.unplayedOnly.set(true);

      component.clearAllFilters();

      expect(component.selectedGenres()).toEqual([]);
      expect(component.years()).toBe('');
      expect(component.debouncedYears()).toBe('');
      expect(component.search()).toBe('');
      expect(component.category()).toBe('all');
      expect(component.showPlayedOnly()).toBe(false);
      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBe(false);
    });
  });

  describe('notPlayed filters and mutual exclusivity', () => {
    it('should update notPlayedSince, reset unplayedOnly and showPlayedOnly, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.showPlayedOnly.set(true);
      component.unplayedOnly.set(true);
      component.onNotPlayedSinceChange('2025-06-01');

      expect(component.notPlayedSince()).toBe('2025-06-01');
      expect(component.unplayedOnly()).toBe(false);
      expect(component.showPlayedOnly()).toBe(false);
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'artist', 'asc', '', 'all', [], '', '2025-06-01', false, {});
    });

    it('should toggle unplayedOnly, reset notPlayedSince and showPlayedOnly, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.showPlayedOnly.set(true);
      component.notPlayedSince.set('2025-06-01');
      component.toggleUnplayedOnly();

      expect(component.unplayedOnly()).toBe(true);
      expect(component.notPlayedSince()).toBe('');
      expect(component.showPlayedOnly()).toBe(false);
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'artist', 'asc', '', 'all', [], '', undefined, true, {});
    });

    it('should clear unplayed filters on clearNotPlayedFilters', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.notPlayedSince.set('2025-06-01');
      component.unplayedOnly.set(true);
      component.clearNotPlayedFilters();

      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBe(false);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 0, 'artist', 'asc', '', 'all', [], '', undefined, false, {});
    });

    it('should reset unplayed filters when showPlayedOnly is activated', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.notPlayedSince.set('2025-06-01');
      component.unplayedOnly.set(true);
      component.showPlayedOnly.set(false);

      component.toggleShowPlayedOnly();

      expect(component.showPlayedOnly()).toBe(true);
      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBe(false);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(1, component.perPage(), 1, 'artist', 'asc', '', 'all', [], '', undefined, false, {});
    });
  });

  describe('onListenLogged', () => {
    it('should update recordDetail and the matching release listen_count', () => {
      component.releases.set([
        {
          id: 100,
          instance_id: 1,
          date_added: '',
          rating: 0,
          listen_count: 2,
          basic_information: {
            id: 100,
            title: 'Test Album',
            year: 2020,
            thumb: '',
            cover_image: '',
            artists: [],
          },
        } as CollectionRelease,
      ]);

      const updatedDetail = {
        id: 1,
        discogs_id: 100,
        title: 'Test Album',
        genres: [],
        in_collection: true,
        listen_count: 3,
        tracklist: [],
        formats: [],
        labels: [],
      };

      component.onListenLogged(updatedDetail);

      expect(component.recordDetail()).toEqual(updatedDetail);
      expect(component.releases()[0].listen_count).toBe(3);
    });
  });

  describe('clearSelection', () => {
    it('should clear all items in selectedItems', () => {
      component.selectedItems.set(new Map([
        [1, { id: 1, title: 'Album 1', artist: 'Artist 1' }],
        [2, { id: 2, title: 'Album 2', artist: 'Artist 2' }],
      ]));
      expect(component.selectedCount()).toBe(2);

      component.clearSelection();

      expect(component.selectedCount()).toBe(0);
      expect(component.selectedItems().size).toBe(0);
    });
  });

  describe('print dialog', () => {
    it('remembers CDs when selecting records', () => {
      const release = (id: number, format: string) => ({
        id,
        basic_information: { title: `Album ${id}`, artists: [{ name: 'Artist' }], format, formats: [] },
      }) as any;

      component.toggleSelection(release(1, 'LP'));
      expect(component.selectedCdIds()).toEqual([]);

      component.releases.set([release(2, 'CD')]);
      component.toggleSelectAllPage();
      expect(component.selectedItems().get(2)?.isCd).toBe(true);
      expect(component.selectedCdIds()).toEqual([2]);
    });

    it('passes the selected Discogs IDs', () => {
      component.selectedItems.set(new Map([
        [11, { id: 11, title: 'Album 1', artist: 'Artist 1' }],
        [22, { id: 22, title: 'Album 2', artist: 'Artist 2' }],
      ]));

      expect(component.selectedIds()).toEqual([11, 22]);
    });

    it('maps the default view to sorting only', () => {
      expect(component.printFilter()).toEqual({ sort: 'artist', sort_order: 'asc' });
    });

    it('maps all active filters like the collection request', () => {
      component.debouncedSearch.set('miles');
      component.category.set('vinyl');
      component.selectedGenres.set(['Jazz', 'Rock']);
      component.debouncedYears.set(' 1959-1961 ');
      component.notPlayedSince.set('2026-01-01');
      component.sort.set('year');
      component.sortOrder.set('desc');

      expect(component.printFilter()).toEqual({
        sort: 'year',
        sort_order: 'desc',
        search: 'miles',
        category: 'vinyl',
        genres: 'Jazz,Rock',
        years: '1959-1961',
        not_played_since: '2026-01-01',
      });

      component.notPlayedSince.set('');
      component.unplayedOnly.set(true);
      expect(component.printFilter().unplayed_only).toBe(true);

      component.unplayedOnly.set(false);
      component.showPlayedOnly.set(true);
      expect(component.printFilter().min_plays).toBe(1);
    });

    it('shows the dialog when printing is requested and hides it when closed', () => {
      mockAuthService.user = signal(null);
      fixture.detectChanges();
      component.showPrintDialog.set(true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-print-dialog')).not.toBeNull();

      component.showPrintDialog.set(false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-print-dialog')).toBeNull();
    });
  });

  describe('onSortKeyUpdated', () => {
    it('shows the updated detail and reloads the collection in the new order', () => {
      const loadData = vi.spyOn(component, 'loadData').mockImplementation(() => undefined);
      const updated = { discogs_id: 100, sort_key: 'Paul, Les', in_collection: true, genres: [], listen_count: 0, tracklist: [], formats: [], labels: [] } as any;

      component.onSortKeyUpdated(updated);

      expect(component.recordDetail()).toEqual(updated);
      expect(loadData).toHaveBeenCalled();
    });
  });

  describe('onConditionUpdated', () => {
    it('should update recordDetail and releases array with new conditions and median price', () => {
      const initialRelease = {
        id: 100,
        instance_id: 1,
        date_added: '',
        rating: 0,
        media_condition: 'Very Good (VG)',
        sleeve_condition: 'Good (G)',
        basic_information: {
          id: 100,
          title: 'Test Album',
          year: 2000,
          thumb: '',
          cover_image: '',
          artists: [],
          median_price: 15.00,
        },
      } as CollectionRelease;

      component.releases.set([initialRelease]);
      component.selectedRecord.set(initialRelease);

      const updatedDetail = {
        id: 1,
        discogs_id: 100,
        title: 'Test Album',
        genres: [],
        in_collection: true,
        listen_count: 2,
        media_condition: 'Mint (M)',
        sleeve_condition: 'Near Mint (NM or M-)',
        median_price: 32.50,
        tracklist: [],
        formats: [],
        labels: [],
      };

      component.onConditionUpdated(updatedDetail);

      expect(component.recordDetail()).toEqual(updatedDetail);
      expect(component.releases()[0].media_condition).toBe('Mint (M)');
      expect(component.releases()[0].sleeve_condition).toBe('Near Mint (NM or M-)');
      expect(component.releases()[0].basic_information.median_price).toBe(32.50);
      expect(component.selectedRecord()?.media_condition).toBe('Mint (M)');
    });
  });

  describe('onRecordRemoved', () => {
    it('should close detail modal and remove record from releases and selectedItems', () => {
      const release1 = { id: 101, instance_id: 1, basic_information: { title: 'Album 1' } } as any;
      const release2 = { id: 102, instance_id: 2, basic_information: { title: 'Album 2' } } as any;

      component.releases.set([release1, release2]);
      component.totalItems.set(2);
      component.selectedRecord.set(release1);
      component.selectedItems.set(new Map([[101, { id: 101, title: 'Album 1', artist: 'Artist 1' }]]));

      component.onRecordRemoved(101);

      expect(component.selectedRecord()).toBeNull();
      expect(component.releases().length).toBe(1);
      expect(component.releases()[0].id).toBe(102);
      expect(component.totalItems()).toBe(1);
      expect(component.selectedItems().has(101)).toBe(false);
    });
  });
});
