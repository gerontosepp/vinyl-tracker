import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CollectionComponent } from './collection.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { of } from 'rxjs';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CollectionRelease } from '../../core/types';

describe('CollectionComponent', () => {
  let component: CollectionComponent;
  let fixture: ComponentFixture<CollectionComponent>;
  let mockApiService: any;
  let mockAuthService: any;
  let mockToastService: any;

  beforeEach(async () => {
    mockApiService = {
      getCollection: jasmine.createSpy('getCollection').and.returnValue(of({ releases: [], pagination: { page: 1, pages: 1, per_page: 50, items: 0, urls: {} } })),
      getGenreBreakdown: jasmine.createSpy('getGenreBreakdown').and.returnValue(of([{ name: 'Rock', value: 10 }])),
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
      exportCollection: jasmine.createSpy('exportCollection').and.returnValue(of(new Blob(['csv'], { type: 'text/csv' }))),
    };
    mockAuthService = {
      isSyncing: signal(false)
    };
    mockToastService = {
      showToast: jasmine.createSpy('showToast')
    };

    await TestBed.configureTestingModule({
      imports: [CollectionComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: mockToastService },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'format',
        'asc',
        '',
        'all',
        [],
        '',
        undefined,
        false
      );
    });
  });

  describe('onCategoryChange', () => {
    it('should update category, reset page to 1, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.page.set(3);
      component.onCategoryChange('cd');
      expect(component.category()).toBe('cd');
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'artist',
        'asc',
        '',
        'cd',
        [],
        '',
        undefined,
        false
      );
    });

    it('should ignore category change if already selected', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      mockApiService.getCollection.calls.reset();
      component.onCategoryChange('all');
      expect(mockApiService.getCollection).not.toHaveBeenCalled();
    });

    it('should set totalItems from pagination items on loadData', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      mockApiService.getCollection.and.returnValue(of({
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
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'artist',
        'asc',
        '',
        'all',
        ['Rock', 'Jazz'],
        '',
        undefined,
        false
      );
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
      expect(component.showPlayedOnly()).toBeFalse();
      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBeFalse();
    });
  });

  describe('notPlayed filters and mutual exclusivity', () => {
    it('should update notPlayedSince, reset unplayedOnly and showPlayedOnly, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.showPlayedOnly.set(true);
      component.unplayedOnly.set(true);
      component.onNotPlayedSinceChange('2025-06-01');

      expect(component.notPlayedSince()).toBe('2025-06-01');
      expect(component.unplayedOnly()).toBeFalse();
      expect(component.showPlayedOnly()).toBeFalse();
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'artist',
        'asc',
        '',
        'all',
        [],
        '',
        '2025-06-01',
        false
      );
    });

    it('should toggle unplayedOnly, reset notPlayedSince and showPlayedOnly, and reload data', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.showPlayedOnly.set(true);
      component.notPlayedSince.set('2025-06-01');
      component.toggleUnplayedOnly();

      expect(component.unplayedOnly()).toBeTrue();
      expect(component.notPlayedSince()).toBe('');
      expect(component.showPlayedOnly()).toBeFalse();
      expect(component.page()).toBe(1);
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'artist',
        'asc',
        '',
        'all',
        [],
        '',
        undefined,
        true
      );
    });

    it('should clear unplayed filters on clearNotPlayedFilters', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.notPlayedSince.set('2025-06-01');
      component.unplayedOnly.set(true);
      component.clearNotPlayedFilters();

      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBeFalse();
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        0,
        'artist',
        'asc',
        '',
        'all',
        [],
        '',
        undefined,
        false
      );
    });

    it('should reset unplayed filters when showPlayedOnly is activated', () => {
      mockAuthService.user = signal({ username: 'testuser' });
      component.notPlayedSince.set('2025-06-01');
      component.unplayedOnly.set(true);
      component.showPlayedOnly.set(false);

      component.toggleShowPlayedOnly();

      expect(component.showPlayedOnly()).toBeTrue();
      expect(component.notPlayedSince()).toBe('');
      expect(component.unplayedOnly()).toBeFalse();
      expect(mockApiService.getCollection).toHaveBeenCalledWith(
        1,
        component.perPage(),
        1,
        'artist',
        'asc',
        '',
        'all',
        [],
        '',
        undefined,
        false
      );
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
      component.selectedItems.set(
        new Map([
          [1, { id: 1, title: 'Album 1', artist: 'Artist 1' }],
          [2, { id: 2, title: 'Album 2', artist: 'Artist 2' }],
        ])
      );
      expect(component.selectedCount()).toBe(2);

      component.clearSelection();

      expect(component.selectedCount()).toBe(0);
      expect(component.selectedItems().size).toBe(0);
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
      expect(component.selectedItems().has(101)).toBeFalse();
    });
  });

  describe('handleExport', () => {
    it('should call exportCollection with format and current active filters', async () => {
      spyOn<any>(component, 'downloadBlob').and.callFake(() => {});
      component.debouncedSearch.set('Pink Floyd');
      component.category.set('vinyl');

      await component.handleExport('pdf');

      expect(mockApiService.exportCollection).toHaveBeenCalledWith('pdf', jasmine.objectContaining({
        search: 'Pink Floyd',
        category: 'vinyl'
      }));
      expect(component.isExporting()).toBeFalse();
      expect(mockToastService.showToast).toHaveBeenCalled();
    });
  });
});
