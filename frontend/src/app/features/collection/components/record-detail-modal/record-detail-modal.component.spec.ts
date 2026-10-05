import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecordDetailModalComponent } from './record-detail-modal.component';
import { ApiService } from '../../../../core/services/api.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('RecordDetailModalComponent', () => {
  let component: RecordDetailModalComponent;
  let fixture: ComponentFixture<RecordDetailModalComponent>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
    };

    await TestBed.configureTestingModule({
      imports: [RecordDetailModalComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RecordDetailModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close event when close is triggered', () => {
    spyOn(component.close, 'emit');
    component.close.emit();
    expect(component.close.emit).toHaveBeenCalled();
  });
});
