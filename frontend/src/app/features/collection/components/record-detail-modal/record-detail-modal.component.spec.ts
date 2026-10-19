import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { RecordDetailModalComponent, ROON_LAST_ZONE_KEY } from './record-detail-modal.component';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RecordDetailDto } from '../../../../core/types';

describe('RecordDetailModalComponent', () => {
  let component: RecordDetailModalComponent;
  let fixture: ComponentFixture<RecordDetailModalComponent>;
  let mockApiService: any;
  let mockToastService: any;
  let mockAuthService: any;
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
    sessionStorage.removeItem(ROON_LAST_ZONE_KEY);

    mockApiService = {
      getProxiedImageUrl: jasmine.createSpy('getProxiedImageUrl').and.callFake((url: string) => url),
      logRecordListen: jasmine.createSpy('logRecordListen').and.returnValue(
        of({ ...mockDetail, listen_count: 4 })
      ),
      playOnRoon: jasmine.createSpy('playOnRoon').and.returnValue(
        of({ success: true, message: 'Playback started' })
      ),
      getRoonZones: jasmine.createSpy('getRoonZones').and.returnValue(
        of([
          { zoneId: 'zone-living', name: 'Living Room', state: 'playing' },
          { zoneId: 'zone-office', name: 'Office', state: 'stopped' },
        ])
      ),
      updateRecordCondition: jasmine.createSpy('updateRecordCondition').and.returnValue(
        of({ ...mockDetail, media_condition: 'Mint (M)', median_price: 29.99 })
      ),
      removeReleaseFromCollection: jasmine.createSpy('removeReleaseFromCollection').and.returnValue(
        of(undefined)
      ),
    };

    mockToastService = {
      showToast: jasmine.createSpy('showToast'),
    };

    mockAuthService = {
      user: signal<any>({
        id: 1,
        username: 'test',
        roonHost: '192.168.1.100',
        roonPort: 9100,
        roonZoneId: 'zone-living',
        roonZoneName: 'Living Room',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [RecordDetailModalComponent],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AuthService, useValue: mockAuthService },
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

  it('should trigger play on Roon successfully with selected zone', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    component.onPlayOnRoon();

    expect(mockApiService.playOnRoon).toHaveBeenCalledWith({
      artist: 'The Beatles',
      title: 'Abbey Road',
      zoneId: 'zone-living',
    });
    expect(component.isPlayingOnRoon()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Wiedergabe auf Roon gestartet (Living Room): The Beatles - Abbey Road 🎶',
      'success'
    );
  });

  it('should toggle zone dropdown and switch selected zone', () => {
    expect(component.isZoneDropdownOpen()).toBeFalse();
    component.toggleZoneDropdown();
    expect(component.isZoneDropdownOpen()).toBeTrue();

    component.selectZone('zone-office');
    expect(component.selectedZoneId()).toBe('zone-office');
    expect(sessionStorage.getItem(ROON_LAST_ZONE_KEY)).toBe('zone-office');
    expect(component.isZoneDropdownOpen()).toBeFalse();
  });

  it('should restore last used zone from sessionStorage on init', () => {
    sessionStorage.setItem(ROON_LAST_ZONE_KEY, 'zone-office');
    component.loadRoonZones();
    expect(component.selectedZoneId()).toBe('zone-office');
  });

  it('should select zone and play immediately when selectAndPlay is called', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    component.selectAndPlay('zone-office');

    expect(component.selectedZoneId()).toBe('zone-office');
    expect(mockApiService.playOnRoon).toHaveBeenCalledWith({
      artist: 'The Beatles',
      title: 'Abbey Road',
      zoneId: 'zone-office',
    });
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Wiedergabe auf Roon gestartet (Office): The Beatles - Abbey Road 🎶',
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

  it('should display media and sleeve conditions when present', () => {
    const mockRecord = {
      id: 42,
      basic_information: {
        id: 123456,
        title: 'Abbey Road',
        year: 1969,
        artists: [{ name: 'The Beatles' }],
      },
    } as any;
    const detailWithCondition = {
      ...mockDetail,
      media_condition: 'Very Good Plus (VG+)',
      sleeve_condition: 'Near Mint (NM)',
    };
    fixture.componentRef.setInput('record', mockRecord);
    fixture.componentRef.setInput('detail', detailWithCondition);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Very Good Plus (VG+)');
    expect(text).toContain('Near Mint (NM)');
    expect(text).toContain('VG+');
    expect(text).toContain('NM');
  });

  it('should display estimated value in record detail modal when median_price is present', () => {
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
    fixture.componentRef.setInput('detail', { ...mockDetail, median_price: 19.99 });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toMatch(/19[.,]99/);
  });

  it('should call updateRecordCondition and emit conditionUpdated when media condition is changed', () => {
    fixture.componentRef.setInput('detail', { ...mockDetail, media_condition: 'Very Good Plus (VG+)' });
    fixture.detectChanges();

    spyOn(component.conditionUpdated, 'emit');

    component.onMediaConditionChange('Mint (M)');

    expect(mockApiService.updateRecordCondition).toHaveBeenCalledWith(42, { media_condition: 'Mint (M)' });
    expect(component.isUpdatingCondition()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      jasmine.any(String),
      'success'
    );
    expect(component.conditionUpdated.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ media_condition: 'Mint (M)', median_price: 29.99 })
    );
  });

  it('should call updateRecordCondition and emit conditionUpdated when sleeve condition is changed', () => {
    fixture.componentRef.setInput('detail', { ...mockDetail, sleeve_condition: 'Good (G)' });
    fixture.detectChanges();

    mockApiService.updateRecordCondition.and.returnValue(
      of({ ...mockDetail, sleeve_condition: 'Near Mint (NM or M-)' })
    );
    spyOn(component.conditionUpdated, 'emit');

    component.onSleeveConditionChange('Near Mint (NM or M-)');

    expect(mockApiService.updateRecordCondition).toHaveBeenCalledWith(42, { sleeve_condition: 'Near Mint (NM or M-)' });
    expect(component.isUpdatingCondition()).toBeFalse();
    expect(component.conditionUpdated.emit).toHaveBeenCalledWith(
      jasmine.objectContaining({ sleeve_condition: 'Near Mint (NM or M-)' })
    );
  });

  it('should handle error when updating condition fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    mockApiService.updateRecordCondition.and.returnValue(
      throwError(() => new Error('Discogs update failed'))
    );

    component.onMediaConditionChange('Mint (M)');

    expect(component.isUpdatingCondition()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      jasmine.stringContaining('Discogs update failed'),
      'error'
    );
  });

  describe('delete / remove from collection flow', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('record', { id: 123456, instance_id: 789 } as any);
      fixture.componentRef.setInput('detail', { ...mockDetail, instance_id: 789 });
      fixture.detectChanges();
    });

    it('should show confirmation banner when promptDelete is called', () => {
      expect(component.showDeleteConfirm()).toBeFalse();
      component.promptDelete();
      expect(component.showDeleteConfirm()).toBeTrue();
    });

    it('should hide confirmation banner when cancelDelete is called', () => {
      component.promptDelete();
      expect(component.showDeleteConfirm()).toBeTrue();
      component.cancelDelete();
      expect(component.showDeleteConfirm()).toBeFalse();
    });

    it('should call apiService.removeReleaseFromCollection and emit recordRemoved on confirmDelete', () => {
      spyOn(component.recordRemoved, 'emit');

      component.confirmDelete();

      expect(mockApiService.removeReleaseFromCollection).toHaveBeenCalledWith(123456, 789);
      expect(component.isRemoving()).toBeFalse();
      expect(component.showDeleteConfirm()).toBeFalse();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        jasmine.any(String),
        'success'
      );
      expect(component.recordRemoved.emit).toHaveBeenCalledWith(123456);
    });

    it('should show error toast when removeReleaseFromCollection fails', () => {
      mockApiService.removeReleaseFromCollection.and.returnValue(
        throwError(() => new Error('Delete failed'))
      );

      component.confirmDelete();

      expect(component.isRemoving()).toBeFalse();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('Delete failed'),
        'error'
      );
    });
  });
});


