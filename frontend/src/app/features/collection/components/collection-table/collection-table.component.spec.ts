import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionTableComponent } from './collection-table.component';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { CollectionRelease } from '../../../../core/types';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CollectionTableComponent', () => {
  let component: CollectionTableComponent;
  let fixture: ComponentFixture<CollectionTableComponent>;
  let mockApiService: any;

  const mockRelease: CollectionRelease = {
    id: 12345,
    instance_id: 1,
    rating: 0,
    basic_information: {
      id: 12345,
      title: 'Bare Bone Nest',
      year: 1999,
      thumb: 'https://example.com/thumb.jpg',
      cover_image: 'https://example.com/cover.jpg',
      formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP'] }],
      artists: [{ name: '22 Pistepirkko' }],
      genres: ['Rock', 'Alternative Rock'],
      styles: [],
    },
    listen_count: 5,
    date_added: '1999-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
    };

    await TestBed.configureTestingModule({
      imports: [CollectionTableComponent, TranslatePipe],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        LanguageService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionTableComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('releases', [mockRelease]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Column 1: should emit toggleSelection when clicking checkbox cell', () => {
    spyOn(component.toggleSelection, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[0].click();
    expect(component.toggleSelection.emit).toHaveBeenCalledWith(mockRelease);
  });

  it('Column 2: should emit openDetail when clicking cover cell', () => {
    spyOn(component.openDetail, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[1].click();
    expect(component.openDetail.emit).toHaveBeenCalledWith(mockRelease);
  });

  it('Column 3: should do nothing when clicking format cell', () => {
    spyOn(component.openDetail, 'emit');
    spyOn(component.toggleSelection, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[2].click();
    expect(component.openDetail.emit).not.toHaveBeenCalled();
    expect(component.toggleSelection.emit).not.toHaveBeenCalled();
  });

  it('Column 4: should emit openDetail when clicking artist cell', () => {
    spyOn(component.openDetail, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[3].click();
    expect(component.openDetail.emit).toHaveBeenCalledWith(mockRelease);
  });

  it('Column 5: should emit openDetail when clicking title cell', () => {
    spyOn(component.openDetail, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[4].click();
    expect(component.openDetail.emit).toHaveBeenCalledWith(mockRelease);
  });

  it('Column 6: should do nothing when clicking genre cell', () => {
    spyOn(component.openDetail, 'emit');
    spyOn(component.toggleSelection, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[5].click();
    expect(component.openDetail.emit).not.toHaveBeenCalled();
    expect(component.toggleSelection.emit).not.toHaveBeenCalled();
  });

  it('Column 7: should do nothing when clicking year cell', () => {
    spyOn(component.openDetail, 'emit');
    spyOn(component.toggleSelection, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[6].click();
    expect(component.openDetail.emit).not.toHaveBeenCalled();
    expect(component.toggleSelection.emit).not.toHaveBeenCalled();
  });

  it('Column 8: should do nothing when clicking plays cell', () => {
    spyOn(component.openDetail, 'emit');
    spyOn(component.toggleSelection, 'emit');
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');

    cells[7].click();
    expect(component.openDetail.emit).not.toHaveBeenCalled();
    expect(component.toggleSelection.emit).not.toHaveBeenCalled();
  });

  it('Column 9: should contain Discogs external link', () => {
    const row = fixture.nativeElement.querySelector('tbody tr');
    const cells = row.querySelectorAll('td');
    const link = cells[8].querySelector('a');

    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://www.discogs.com/release/12345');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});
