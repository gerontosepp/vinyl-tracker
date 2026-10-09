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
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
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

    spyOn(component.openDetail, 'emit');

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
});
