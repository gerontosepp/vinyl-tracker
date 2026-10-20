import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionCardListComponent } from './collection-card-list.component';
import { ApiService } from '../../../../core/services/api.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CollectionCardListComponent', () => {
  let component: CollectionCardListComponent;
  let fixture: ComponentFixture<CollectionCardListComponent>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: vi.fn().mockName('getProxiedImageUrl').mockImplementation((url: string) => url),
    };

    await TestBed.configureTestingModule({
      imports: [CollectionCardListComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionCardListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit openDetail when clicking a release card', () => {
    const mockRelease: any = {
      id: 123,
      basic_information: {
        title: 'Abbey Road',
        artists: [{ name: 'The Beatles' }],
        formats: [{ name: 'Vinyl', descriptions: ['LP'] }],
      },
    };
    fixture.componentRef.setInput('releases', [mockRelease]);
    fixture.detectChanges();

    vi.spyOn(component.openDetail, 'emit').mockReturnValue(undefined);

    const card = fixture.nativeElement.querySelector('.group');
    expect(card).toBeTruthy();
    card.click();

    expect(component.openDetail.emit).toHaveBeenCalledWith(mockRelease);
  });

  it('should return format type correctly', () => {
    const mockRelease: any = {
      id: 123,
      basic_information: {
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP'] }],
      },
    };
    expect(component.getFormatType(mockRelease)).toBe('double_lp');
  });

  it('renders compact rows with a small cover, metadata and play count', () => {
    const mockRelease: any = {
      id: 7,
      listen_count: 3,
      media_condition: 'Near Mint (NM or M-)',
      basic_information: {
        title: 'Kind of Blue',
        year: 1959,
        thumb: 'https://i.discogs.com/kob.jpg',
        artists: [{ name: 'Miles Davis' }],
        formats: [{ name: 'Vinyl', descriptions: ['LP'] }],
        median_price: 30,
      },
    };
    fixture.componentRef.setInput('releases', [mockRelease]);
    fixture.detectChanges();

    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="collection-card-list"] li button');
    expect(row.type).toBe('button');
    expect(row.textContent).toContain('Kind of Blue');
    expect(row.textContent).toContain('Miles Davis');
    expect(row.textContent).toContain('1959');
    expect(row.textContent).toContain('3×');
    expect(row.getAttribute('aria-label')).toContain('Kind of Blue');

    const cover: HTMLElement = row.querySelector('[data-testid="card-cover"]')!;
    expect(cover.classList).toContain('w-12');
    expect(cover.classList).toContain('h-12');
    expect(cover.querySelector('img')).toBeTruthy();
  });

  it('shows a placeholder without cover and no condition line without data', () => {
    const mockRelease: any = {
      id: 8,
      basic_information: { title: 'No Cover', artists: [], formats: [] },
    };
    fixture.componentRef.setInput('releases', [mockRelease]);
    fixture.detectChanges();

    const row: HTMLElement = fixture.nativeElement.querySelector('li button');
    expect(row.querySelector('img')).toBeNull();
    expect(row.textContent).toContain('Unknown');
    expect(row.textContent).toContain('0×');
    expect(row.textContent).not.toContain('€');
  });

  it('shows the shelf slot below the artist when available', () => {
    const slot = { unitId: 1, unitName: 'Kallax-1', compartment: 3, row: 1, column: 3, oversized: false, unplaced: false };
    const release: any = { id: 9, basic_information: { title: 'T', artists: [], formats: [] }, storage: slot };
    fixture.componentRef.setInput('releases', [release, { ...release, id: 10, storage: undefined }]);
    fixture.detectChanges();

    const slots: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="card-storage"]'));
    expect(slots.length).toBe(1);
    expect(slots[0].textContent).toContain('Kallax-1 · 3');
  });
});
