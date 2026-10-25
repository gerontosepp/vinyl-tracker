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
import { RecordDetailDto, TakeoverResult } from '../../../../core/types';

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
      getProxiedImageUrl: vi.fn().mockName('getProxiedImageUrl').mockImplementation((url: string) => url),
      logRecordListen: vi.fn().mockName('logRecordListen').mockReturnValue(of({ ...mockDetail, listen_count: 4 })),
      playOnRoon: vi.fn().mockName('playOnRoon').mockReturnValue(of({ success: true, message: 'Playback started' })),
      getRoonZones: vi.fn().mockName('getRoonZones').mockReturnValue(of([
        { zoneId: 'zone-living', name: 'Living Room', state: 'playing' },
        { zoneId: 'zone-office', name: 'Office', state: 'stopped' },
      ])),
      updateRecordCondition: vi.fn().mockName('updateRecordCondition').mockReturnValue(of({ ...mockDetail, media_condition: 'Mint (M)', median_price: 29.99 })),
      removeReleaseFromCollection: vi.fn().mockName('removeReleaseFromCollection').mockReturnValue(of(undefined)),
      updateRecordSortKey: vi.fn().mockName('updateRecordSortKey').mockReturnValue(of({ ...mockDetail, sort_key: 'Fab Four' })),
    };

    mockToastService = {
      showToast: vi.fn().mockName('showToast'),
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

  it('stacks the overlay above the mobile bottom navigation (z-50)', () => {
    fixture.componentRef.setInput('record', { id: 42, basic_information: { id: 123456, title: 'Abbey Road', artists: [] } } as any);
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('div.fixed.inset-0') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('z-[60]')).toBe(true);
  });

  it('should emit close event when close is triggered', () => {
    vi.spyOn(component.close, 'emit').mockReturnValue(undefined);
    component.close.emit();
    expect(component.close.emit).toHaveBeenCalled();
  });

  it('should log listen event successfully and emit updated detail', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    vi.spyOn(component.listenLogged, 'emit').mockReturnValue(undefined);

    component.onLogListen();

    expect(mockApiService.logRecordListen).toHaveBeenCalledWith(42);
    expect(component.isLoggingListen()).toBe(false);
    expect(component.justListened()).toBe(true);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Hör-Event für "Abbey Road" erfasst! 🎵', 'success');
    expect(component.listenLogged.emit).toHaveBeenCalledWith(expect.objectContaining({ listen_count: 4 }));
  });

  it('should handle error when logging listen event fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    mockApiService.logRecordListen.mockReturnValue(throwError(() => new Error('Server error')));
    fixture.detectChanges();

    component.onLogListen();

    expect(component.isLoggingListen()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringContaining('Server error'), 'error');
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
    expect(component.isPlayingOnRoon()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Wiedergabe auf Roon gestartet (Living Room): The Beatles - Abbey Road 🎶', 'success');
  });

  it('should toggle zone dropdown and switch selected zone', () => {
    expect(component.isZoneDropdownOpen()).toBe(false);
    component.toggleZoneDropdown();
    expect(component.isZoneDropdownOpen()).toBe(true);

    component.selectZone('zone-office');
    expect(component.selectedZoneId()).toBe('zone-office');
    expect(sessionStorage.getItem(ROON_LAST_ZONE_KEY)).toBe('zone-office');
    expect(component.isZoneDropdownOpen()).toBe(false);
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
    expect(mockToastService.showToast).toHaveBeenCalledWith('Wiedergabe auf Roon gestartet (Office): The Beatles - Abbey Road 🎶', 'success');
  });

  it('should handle error when play on Roon fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    mockApiService.playOnRoon.mockReturnValue(throwError(() => new Error('Roon offline')));
    fixture.detectChanges();

    component.onPlayOnRoon();

    expect(component.isPlayingOnRoon()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringContaining('Roon offline'), 'error');
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

  it('should show the shelf slot and neighbors only when shelves are configured', () => {
    fixture.componentRef.setInput('record', { id: 42, basic_information: { id: 123456, title: 'Abbey Road', artists: [] } } as any);
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="detail-storage"]')).toBeNull();

    TestBed.inject(LanguageService).setLanguage('de');
    fixture.componentRef.setInput('detail', {
      ...mockDetail,
      storage: { unitId: 1, unitName: 'Kallax-1', compartment: 2, row: 1, column: 2, oversized: false, unplaced: false },
      storage_neighbors: { previous: { discogsId: 7, artist: 'Abba', title: 'Gold' }, next: null },
    });
    fixture.detectChanges();

    const section: HTMLElement = fixture.nativeElement.querySelector('[data-testid="detail-storage"]');
    expect(section.textContent).toContain('Kallax-1 · Fach 2');
    expect(section.textContent).toContain('Abba – Gold');
    expect(section.textContent).toContain('ganz hinten');
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

    vi.spyOn(component.conditionUpdated, 'emit').mockReturnValue(undefined);

    component.onMediaConditionChange('Mint (M)');

    expect(mockApiService.updateRecordCondition).toHaveBeenCalledWith(42, { media_condition: 'Mint (M)' });
    expect(component.isUpdatingCondition()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
    expect(component.conditionUpdated.emit).toHaveBeenCalledWith(expect.objectContaining({ media_condition: 'Mint (M)', median_price: 29.99 }));
  });

  it('should call updateRecordCondition and emit conditionUpdated when sleeve condition is changed', () => {
    fixture.componentRef.setInput('detail', { ...mockDetail, sleeve_condition: 'Good (G)' });
    fixture.detectChanges();

    mockApiService.updateRecordCondition.mockReturnValue(of({ ...mockDetail, sleeve_condition: 'Near Mint (NM or M-)' }));
    vi.spyOn(component.conditionUpdated, 'emit').mockReturnValue(undefined);

    component.onSleeveConditionChange('Near Mint (NM or M-)');

    expect(mockApiService.updateRecordCondition).toHaveBeenCalledWith(42, { sleeve_condition: 'Near Mint (NM or M-)' });
    expect(component.isUpdatingCondition()).toBe(false);
    expect(component.conditionUpdated.emit).toHaveBeenCalledWith(expect.objectContaining({ sleeve_condition: 'Near Mint (NM or M-)' }));
  });

  it('should handle error when updating condition fails', () => {
    fixture.componentRef.setInput('detail', mockDetail);
    fixture.detectChanges();

    mockApiService.updateRecordCondition.mockReturnValue(throwError(() => new Error('Discogs update failed')));

    component.onMediaConditionChange('Mint (M)');

    expect(component.isUpdatingCondition()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringContaining('Discogs update failed'), 'error');
  });

  describe('custom sort string', () => {
    const showDetail = (detail: RecordDetailDto) => {
      fixture.componentRef.setInput('record', { id: 42, basic_information: { id: 123456, title: 'Abbey Road', artists: [] } } as any);
      fixture.componentRef.setInput('detail', detail);
      fixture.detectChanges();
    };
    const input = (): HTMLInputElement => fixture.nativeElement.querySelector('#sort-key-input');
    const type = (value: string) => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('shows the automatic key as placeholder and only saves a changed value', () => {
      showDetail({ ...mockDetail, default_sort_key: 'beatles' });
      expect(input().placeholder).toBe('beatles');
      expect(input().value).toBe('');
      const save: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="sort-key-save"]');
      expect(save.disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="sort-key-reset"]')).toBeNull();

      vi.spyOn(component.sortKeyUpdated, 'emit');
      type('  Fab Four ');
      expect(save.disabled).toBe(false);
      save.click();

      expect(mockApiService.updateRecordSortKey).toHaveBeenCalledWith(42, 'Fab Four');
      expect(component.sortKeyUpdated.emit).toHaveBeenCalledWith({ ...mockDetail, sort_key: 'Fab Four' });
      expect(mockToastService.showToast).toHaveBeenCalledWith(languageService.translate('collection.sortKeyUpdated'), 'success');
    });

    it('resets a stored value and follows the shown record', () => {
      showDetail({ ...mockDetail, sort_key: 'Fab Four' });
      expect(input().value).toBe('Fab Four');
      type('Something else');

      showDetail({ ...mockDetail, id: 43, sort_key: 'Other' });
      expect(input().value).toBe('Other');

      fixture.nativeElement.querySelector('[data-testid="sort-key-reset"]').click();
      expect(mockApiService.updateRecordSortKey).toHaveBeenCalledWith(43, null);
    });

    it('saves an emptied field as reset', () => {
      showDetail({ ...mockDetail, sort_key: 'Fab Four' });
      type('   ');
      component.saveSortKey();
      expect(mockApiService.updateRecordSortKey).toHaveBeenCalledWith(42, null);
    });

    it('shows an error toast when saving fails', () => {
      mockApiService.updateRecordSortKey.mockReturnValue(throwError(() => new Error('boom')));
      showDetail(mockDetail);
      type('X');
      component.saveSortKey();
      expect(component.isSavingSortKey()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('is hidden for records outside the collection', () => {
      showDetail({ ...mockDetail, in_collection: false });
      expect(fixture.nativeElement.querySelector('[data-testid="detail-sort-key"]')).toBeNull();
    });
  });

  describe('delete / remove from collection flow', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('record', { id: 123456, instance_id: 789 } as any);
      fixture.componentRef.setInput('detail', { ...mockDetail, instance_id: 789 });
      fixture.detectChanges();
    });

    it('should show confirmation banner when promptDelete is called', () => {
      expect(component.showDeleteConfirm()).toBe(false);
      component.promptDelete();
      expect(component.showDeleteConfirm()).toBe(true);
    });

    it('should hide confirmation banner when cancelDelete is called', () => {
      component.promptDelete();
      expect(component.showDeleteConfirm()).toBe(true);
      component.cancelDelete();
      expect(component.showDeleteConfirm()).toBe(false);
    });

    it('should call apiService.removeReleaseFromCollection and emit recordRemoved on confirmDelete', () => {
      vi.spyOn(component.recordRemoved, 'emit').mockReturnValue(undefined);

      component.confirmDelete();

      expect(mockApiService.removeReleaseFromCollection).toHaveBeenCalledWith(123456, 789);
      expect(component.isRemoving()).toBe(false);
      expect(component.showDeleteConfirm()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
      expect(component.recordRemoved.emit).toHaveBeenCalledWith(123456);
    });

    it('should show error toast when removeReleaseFromCollection fails', () => {
      mockApiService.removeReleaseFromCollection.mockReturnValue(throwError(() => new Error('Delete failed')));

      component.confirmDelete();

      expect(component.isRemoving()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith(expect.stringContaining('Delete failed'), 'error');
    });
  });

  describe('Escape key', () => {
    const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    it('closes the open modal', () => {
      fixture.componentRef.setInput('record', { id: 123456, basic_information: { title: 'Abbey Road', artists: [] } });
      fixture.detectChanges();
      const closed = vi.fn();
      component.close.subscribe(closed);

      pressEscape();
      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('closes the delete confirmation first', () => {
      fixture.componentRef.setInput('record', { id: 123456, basic_information: { title: 'Abbey Road', artists: [] } });
      fixture.detectChanges();
      const closed = vi.fn();
      component.close.subscribe(closed);
      component.promptDelete();

      pressEscape();
      expect(component.showDeleteConfirm()).toBe(false);
      expect(closed).not.toHaveBeenCalled();
    });

    it('does nothing while no record is shown', () => {
      const closed = vi.fn();
      component.close.subscribe(closed);
      pressEscape();
      expect(closed).not.toHaveBeenCalled();
    });
  });

  describe('manual records', () => {
    const q = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

    function show(source: 'manual' | 'discogs'): void {
      TestBed.inject(LanguageService).setLanguage('de');
      fixture.componentRef.setInput('record', { id: -3, source, basic_information: { id: -3, title: 'Posen', artists: [] } } as any);
      fixture.componentRef.setInput('detail', { ...mockDetail, discogs_id: -3, source });
      fixture.detectChanges();
    }

    it('marks a manual record, shows its local number and offers editing instead of Discogs', () => {
      show('manual');
      expect(q('detail-manual-badge')?.textContent).toContain('Manuell');
      expect(fixture.nativeElement.textContent).toContain('#3');
      expect(q('detail-discogs-link')).toBeNull();

      const edited: RecordDetailDto[] = [];
      component.editManual.subscribe((d) => edited.push(d));
      (q('detail-edit-manual') as HTMLButtonElement).click();
      expect(edited[0].discogs_id).toBe(-3);
    });

    it('links Discogs releases to Discogs and offers no editing', () => {
      show('discogs');
      expect(q('detail-manual-badge')).toBeNull();
      expect(q('detail-edit-manual')).toBeNull();
      expect(q('detail-discogs-link')).not.toBeNull();
      expect(q('discogs-takeover')).toBeNull();
    });

    it('offers the Discogs check only for manual records', () => {
      show('manual');
      expect(q('discogs-takeover')).not.toBeNull();
      expect(q('detail-takeover-done')).toBeNull();
    });

    it('shows the result of a takeover with its shelf placement and passes it on', () => {
      show('manual');
      const emitted: TakeoverResult[] = [];
      component.takenOver.subscribe((r) => emitted.push(r));
      const record = { ...mockDetail, discogs_id: 1001, source: 'discogs' as const };
      const result: TakeoverResult = {
        record,
        instanceId: 555,
        mode: 'new_copy',
        placement: { discogsId: 1001, slot: { unitName: 'Kallax', compartment: 2 } as any, neighbors: {} as any, moves: [] },
      };

      component.onTakenOver(result);
      fixture.componentRef.setInput('detail', record);
      fixture.detectChanges();

      expect(emitted).toEqual([result]);
      expect(q('detail-takeover-done')?.textContent).toContain('jetzt eine Discogs-Platte');
      expect(q('discogs-takeover')).toBeNull();

      // Another record does not show the result
      fixture.componentRef.setInput('detail', { ...mockDetail, discogs_id: 7 });
      fixture.detectChanges();
      expect(q('detail-takeover-done')).toBeNull();
    });
  });
});
