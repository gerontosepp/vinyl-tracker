import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecordDetailModalComponent } from './record-detail-modal.component';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecordDetailDto } from '../../../../core/types';

describe('RecordDetailModalComponent', () => {
  let component: RecordDetailModalComponent;
  let fixture: ComponentFixture<RecordDetailModalComponent>;
  let mockApiService: any;
  let mockToastService: any;

  const mockDetail: RecordDetailDto = {
    id: 42,
    discogs_id: 123456,
    title: 'Abbey Road',
    artist: 'The Beatles',
    genres: ['Rock'],
    in_collection: true,
    listen_count: 3,
    tracklist: [],
    formats: [],
    labels: [],
  };

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
      logRecordListen: jasmine.createSpy('logRecordListen').and.returnValue(
        of({ ...mockDetail, listen_count: 4 })
      ),
    };

    mockToastService = {
      showToast: jasmine.createSpy('showToast'),
    };

    await TestBed.configureTestingModule({
      imports: [RecordDetailModalComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
      ],
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

  it('should log listen event successfully and emit updated detail', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    spyOn(component.listenLogged, 'emit');

    component.onLogListen();

    expect(mockApiService.logRecordListen).toHaveBeenCalledWith(42);
    expect(component.isLoggingListen()).toBeFalse();
    expect(component.justListened()).toBeTrue();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Hör-Event für "Abbey Road" erfasst! 🎵',
      'success'
    );
    expect(component.listenLogged.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ listen_count: 4 })
    );
  });

  it('should handle error when logging listen event fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    mockApiService.logRecordListen.and.returnValue(
      throwError(() => new Error('Server error'))
    );
    fixture.detectChanges();

    component.onLogListen();

    expect(component.isLoggingListen()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      jasmine.stringContaining('Server error'),
      'error'
    );
  });
});
