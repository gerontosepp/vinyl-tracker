import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionTableComponent } from './collection-table.component';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CollectionTableComponent', () => {
  let component: CollectionTableComponent;
  let fixture: ComponentFixture<CollectionTableComponent>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
    };

    await TestBed.configureTestingModule({
      imports: [CollectionTableComponent, TranslatePipe],
      providers: [{ provide: ApiService, useValue: mockApiService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
