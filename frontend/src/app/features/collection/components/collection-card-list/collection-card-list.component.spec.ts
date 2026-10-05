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
});
