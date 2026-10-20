import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopRecordsComponent } from './top-records.component';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { AnalyticsTopRecord } from '../../../../core/types';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('TopRecordsComponent', () => {
  let component: TopRecordsComponent;
  let fixture: ComponentFixture<TopRecordsComponent>;
  let mockApiService: any;

  const mockRecords: AnalyticsTopRecord[] = [
    { recordTitle: 'Album 1', title: 'Album 1', artist: 'Artist 1', count: 20, thumbUrl: 'https://img.test/1.jpg' },
    { recordTitle: 'Album 2', title: 'Album 2', artist: 'Artist 2', count: 15, thumbUrl: '' },
    { recordTitle: 'Album 3', title: 'Album 3', artist: 'Artist 3', count: 12, thumbUrl: 'https://img.test/3.jpg' },
    { recordTitle: 'Album 4', title: 'Album 4', artist: 'Artist 4', count: 9, thumbUrl: '' },
    { recordTitle: 'Album 5', title: 'Album 5', artist: 'Artist 5', count: 7, thumbUrl: '' },
    { recordTitle: 'Album 6', title: 'Album 6', artist: 'Artist 6', count: 5, thumbUrl: '' },
    { recordTitle: 'Album 7', title: 'Album 7', artist: 'Artist 7', count: 3, thumbUrl: '' },
  ];

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: vi.fn().mockName('getProxiedImageUrl').mockImplementation((url: string) => url),
    };

    await TestBed.configureTestingModule({
      imports: [TopRecordsComponent, TranslatePipe],
      providers: [{ provide: ApiService, useValue: mockApiService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TopRecordsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('data', mockRecords);
    fixture.detectChanges();
  });

  describe('artists tab', () => {
    const artists = Array.from({ length: 6 }, (_, i) => ({
      artist: `Band ${i + 1}`,
      count: 30 - i,
      recordCount: i + 1,
      thumbUrls: i === 0 ? ['https://img.test/a.jpg', 'https://img.test/b.jpg'] : [],
    }));
    const el = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));

    beforeEach(() => {
      fixture.componentRef.setInput('artists', artists);
      fixture.detectChanges();
    });

    it('starts with the albums and switches to the artists', () => {
      expect(component.tab()).toBe('records');
      expect(el('[data-testid="top-artist-open"]').length).toBe(0);

      el('[data-testid="top-tab-artists"]')[0].click();
      fixture.detectChanges();

      expect(component.tab()).toBe('artists');
      expect(el('[data-testid="top-artist-open"]').length).toBe(5);
      expect(el('app-artist-collage').length).toBe(5);
      expect(fixture.nativeElement.textContent).toContain('Band 1');
      expect(component.maxCount()).toBe(30);
      expect(component.activeCount()).toBe(6);
    });

    it('shows all artists on demand and resets that when switching tabs', () => {
      component.selectTab('artists');
      component.toggleShowAll();
      fixture.detectChanges();
      expect(component.visibleArtists().length).toBe(6);

      component.selectTab('records');
      expect(component.showAll()).toBe(false);
      expect(component.maxCount()).toBe(20);
    });

    it('emits the clicked artist', () => {
      const opened: string[] = [];
      component.openArtist.subscribe((a) => opened.push(a.artist));
      component.selectTab('artists');
      fixture.detectChanges();
      el('[data-testid="top-artist-open"]')[1].click();
      expect(opened).toEqual(['Band 2']);
    });

    it('shows the empty state without artists', () => {
      fixture.componentRef.setInput('artists', []);
      component.selectTab('artists');
      fixture.detectChanges();
      expect(component.activeCount()).toBe(0);
      expect(component.maxCount()).toBe(0);
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute maxCount correctly', () => {
    expect(component.maxCount()).toBe(20);
  });

  it('should display top 5 records by default and toggle showAll', () => {
    // By default: capped at 5
    expect(component.visibleData().length).toBe(5);
    expect(component.showAll()).toBe(false);

    // Toggle show more
    component.toggleShowAll();
    fixture.detectChanges();

    expect(component.showAll()).toBe(true);
    expect(component.visibleData().length).toBe(7);

    // Toggle back to show less
    component.toggleShowAll();
    fixture.detectChanges();

    expect(component.showAll()).toBe(false);
    expect(component.visibleData().length).toBe(5);
  });

  it('should display empty state when data is empty', () => {
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();

    expect(component.maxCount()).toBe(0);
    expect(component.visibleData().length).toBe(0);

    const langService = TestBed.inject(LanguageService);
    const emptyText = fixture.nativeElement.textContent;
    expect(emptyText).toContain(langService.translate('collection.noRecords'));
  });

  it('should render rank numbers and cover image correctly', () => {
    const titles = fixture.nativeElement.querySelectorAll('h3');
    expect(titles.length).toBe(5);
    expect(titles[0].textContent).toContain('Album 1');
    expect(titles[1].textContent).toContain('Album 2');

    const plays = fixture.nativeElement.querySelectorAll('span');
    const playTexts = Array.from(plays).map((p: any) => p.textContent);
    expect(playTexts.some((t: string) => t.includes('20'))).toBe(true);
  });

  it('opens the record details from a row with a Discogs ID', () => {
    fixture.componentRef.setInput('data', [
      { ...mockRecords[0], discogsId: 4711 },
      mockRecords[1], // from an older server: no ID, not clickable
    ]);
    fixture.detectChanges();
    const opened = vi.fn();
    component.openRecord.subscribe(opened);

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="top-record-open"]')
    );
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('Details: Album 1');

    buttons[0].click();
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ discogsId: 4711, title: 'Album 1' }));
  });
});
