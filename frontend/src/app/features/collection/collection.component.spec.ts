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
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url)
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
        ''
      );
    });
  });
});
