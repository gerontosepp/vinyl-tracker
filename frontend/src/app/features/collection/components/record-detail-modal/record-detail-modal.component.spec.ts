import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { RecordDetailModalComponent } from './record-detail-modal.component';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecordDetailDto } from '../../../../core/types';

describe('RecordDetailModalComponent', () => {
  let component: RecordDetailModalComponent;
  let fixture: ComponentFixture<RecordDetailModalComponent>;
  let mockApiService: any;
  let mockToastService: any;
  let languageService: LanguageService;

  const mockDetail: RecordDetailDto = {
    id: 42,
    discogs_id: 123456,
    title: 'Abbey Road',
    artist: 'The Beatles',
    genres: ['Rock'],
    in_collection: true,
    listen_count: 3,
    added_at: '2026-10-08T12:00:00Z',
    tracklist: [],
    formats: [],
    labels: [],
  };

  beforeAll(() => {
    registerLocaleData(localeDe);
    registerLocaleData(localeEn);
  });

  beforeEach(async () => {
    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
      logRecordListen: jasmine.createSpy('logRecordListen').and.returnValue(
        of({ ...mockDetail, listen_count: 4 })
      ),
      playOnRoon: jasmine.createSpy('playOnRoon').and.returnValue(
        of({ success: true, message: 'Playback started' })
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
        LanguageService,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    languageService = TestBed.inject(LanguageService);
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

  it('should trigger play on Roon successfully', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    component.onPlayOnRoon();

    expect(mockApiService.playOnRoon).toHaveBeenCalledWith({
      artist: 'The Beatles',
      title: 'Abbey Road',
    });
    expect(component.isPlayingOnRoon()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Wiedergabe auf Roon gestartet: The Beatles - Abbey Road 🎶',
      'success'
    );
  });

  it('should handle error when play on Roon fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    mockApiService.playOnRoon.and.returnValue(
      throwError(() => new Error('Roon offline'))
    );
    fixture.detectChanges();

    component.onPlayOnRoon();

    expect(component.isPlayingOnRoon()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      jasmine.stringContaining('Roon offline'),
      'error'
    );
  });

  it('should format added_at according to active language (German / English)', () => {
    const mockRecord = {
      id: 42,
      basic_information: {
        id: 123456,
        title: 'Abbey Road',
        year: 1969,
        artists: [{ name: 'The Beatles' }],
      },
    } as any;
    fixture.componentRef.setInput('record', mockRecord);
    fixture.componentRef.setInput('detail', mockDetail);

    // Test German locale: 08.10.2026
    languageService.setLanguage('de');
    fixture.detectChanges();
    let text = fixture.nativeElement.textContent;
    expect(text).toContain('08.10.2026');

    // Test English locale: Oct 8, 2026
    languageService.setLanguage('en');
    fixture.detectChanges();
    text = fixture.nativeElement.textContent;
    expect(text).toContain('Oct 8, 2026');
  });
});

