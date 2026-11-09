import type { Mock, MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarcodeScannerComponent } from './barcode-scanner.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ScannerService, SCAN_RESULT_DISPLAY_DEFAULT_SECONDS } from '../../../core/services/scanner.service';
import { Observable, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { User, ScanResult, SyncResult } from '../../../core/types';
import { provideRouter } from '@angular/router';

const SCAN_RESULT_DISPLAY_MS = SCAN_RESULT_DISPLAY_DEFAULT_SECONDS * 1000;

describe('BarcodeScannerComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  let component: BarcodeScannerComponent;
  let fixture: ComponentFixture<BarcodeScannerComponent>;
  let apiServiceMock: MockedObject<ApiService>;
  let toastServiceMock: MockedObject<ToastService>;
  let authServiceMock: {
    user: Mock;
  };

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    discogsUsername: 'discogsuser',
  };

  beforeEach(async () => {
    localStorage.clear();
    apiServiceMock = {
      scanBarcode: vi.fn().mockName("ApiService.scanBarcode"),
      addReleaseToCollection: vi.fn().mockName("ApiService.addReleaseToCollection"),
      getWantToHave: vi.fn().mockName("ApiService.getWantToHave").mockReturnValue(of([])),
      addWantToHave: vi.fn().mockName("ApiService.addWantToHave"),
      getProxiedImageUrl: vi.fn().mockName("ApiService.getProxiedImageUrl"),
      labelPhotosResource: vi.fn().mockName("ApiService.labelPhotosResource").mockReturnValue({ hasValue: () => true, value: () => ({ photos: [], pendingCount: 0 }) })
    } as unknown as MockedObject<ApiService>;
    apiServiceMock.getProxiedImageUrl.mockImplementation((url: string) => url);

    toastServiceMock = {
      showToast: vi.fn().mockName("ToastService.showToast")
    } as unknown as MockedObject<ToastService>;

    authServiceMock = {
      user: vi.fn().mockName('user').mockReturnValue(mockUser),
    };

    await TestBed.configureTestingModule({
      imports: [BarcodeScannerComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: apiServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeScannerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers the label photo capture below the manual input', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-label-photo-capture')).not.toBeNull();
  });

  it('should display success card when scanResult is successful', () => {
    const mockResult: ScanResult = {
      success: true,
      message: 'Now playing: Abbey Road',
      record: {
        discogsId: 100,
        title: 'Abbey Road',
        artist: 'The Beatles',
        thumbUrl: 'http://thumb.jpg',
      },
    };

    component.scanResult.set(mockResult);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Jetzt aufgelegt!');
    expect(compiled.textContent).toContain('Abbey Road');
    expect(compiled.textContent).toContain('The Beatles');
  });

  it('should display Discogs matches card when release is found on Discogs but not in collection', () => {
    const mockResult: ScanResult = {
      success: false,
      message: 'Release not found in collection, but found on Discogs.',
      discogsMatches: [
        {
          id: 501,
          title: 'The Dark Side of the Moon',
          year: '1973',
          thumbUrl: 'http://pinkfloyd.jpg',
          format: ['Vinyl', 'LP'],
          country: 'UK',
        },
        {
          id: 502,
          title: 'The Dark Side of the Moon (Reissue)',
          year: '2016',
          thumbUrl: 'http://pinkfloyd-reissue.jpg',
          format: ['Vinyl', 'LP', 'Remastered'],
          country: 'Europe',
        },
      ],
    };

    component.scanResult.set(mockResult);
    component.selectedMatchId.set(501);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nicht in Sammlung – auf Discogs gefunden');
    expect(compiled.textContent).toContain('The Dark Side of the Moon');
    expect(compiled.textContent).toContain('Zu Discogs hinzufügen & synchronisieren');
  });

  it('should select match when clicked', () => {
    const matches = [
      { id: 1, title: 'Release 1' },
      { id: 2, title: 'Release 2' },
    ];
    component.selectedMatchId.set(1);
    expect(component.getSelectedMatch(matches)?.id).toBe(1);

    component.selectedMatchId.set(2);
    expect(component.getSelectedMatch(matches)?.id).toBe(2);
  });

  it('should add release to Discogs and show success state', async () => {
    vi.useFakeTimers();
    const syncResult: SyncResult = { added: 1, removed: 0 };
    apiServiceMock.addReleaseToCollection.mockReturnValue(of(syncResult));

    component.addToDiscogs(501);
    await vi.advanceTimersByTimeAsync(0);

    expect(apiServiceMock.addReleaseToCollection).toHaveBeenCalledWith(501);
    expect(component.addSuccessMessage()).toContain('Platte erfolgreich zu Discogs hinzugefügt');
    expect(toastServiceMock.showToast).toHaveBeenCalledWith('Erfolgreich zu deiner Discogs-Sammlung hinzugefügt!', 'success');
    expect(component.isAddingToCollection()).toBe(false);
    expect(component.placement()).toBeNull();
  });

  it('saves the chosen match on the want-to-have list and then shows the hint instead of the button', async () => {
    apiServiceMock.addWantToHave.mockReturnValue(
      of({ id: 9, discogs_id: 501, title: 'Abbey Road', artist: 'The Beatles', genres: [], created_at: '2026-11-04T10:00:00+00:00' })
    );
    component.scanResult.set({
      success: false,
      message: 'Choose',
      discogsMatches: [{ id: 501, title: 'Abbey Road' }],
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="scanner-want"]').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiServiceMock.addWantToHave).toHaveBeenCalledWith(501);
    expect(fixture.nativeElement.querySelector('[data-testid="scanner-want"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="scanner-want-listed"]')).not.toBeNull();
    expect(component.isAddingWanted()).toBe(false);
  });

  it('should show where the added record belongs on the shelf', async () => {
    vi.useFakeTimers();
    const slot = { unitId: 1, unitName: 'Kallax-1', compartment: 2, row: 1, column: 2, oversized: false, unplaced: false };
    const syncResult: SyncResult = {
      added: 1,
      removed: 0,
      placement: { discogsId: 501, slot, neighbors: { previous: null, next: null }, moves: [] },
    };
    apiServiceMock.addReleaseToCollection.mockReturnValue(of(syncResult));

    component.addToDiscogs(501);
    await vi.advanceTimersByTimeAsync(0);

    expect(component.placement()?.slot.unitName).toBe('Kallax-1');
    component.handleReset();
    expect(component.placement()).toBeNull();
  });

  it('should handle error when adding release to Discogs fails', async () => {
    vi.useFakeTimers();
    apiServiceMock.addReleaseToCollection.mockReturnValue(throwError(() => ({ error: { message: 'Discogs rate limit reached' } })));

    component.addToDiscogs(501);
    await vi.advanceTimersByTimeAsync(0);

    expect(component.addErrorMessage()).toBe('Discogs rate limit reached');
    expect(toastServiceMock.showToast).toHaveBeenCalledWith('Discogs rate limit reached', 'error');
    expect(component.isAddingToCollection()).toBe(false);
  });

  it('should reset scanner state on handleReset', () => {
    component.scanResult.set({ success: true, message: 'Done' });
    component.selectedMatchId.set(501);
    component.addSuccessMessage.set('Added');
    component.addErrorMessage.set('Error');

    component.handleReset();

    expect(component.scanResult()).toBeNull();
    expect(component.selectedMatchId()).toBeNull();
    expect(component.addSuccessMessage()).toBeNull();
    expect(component.addErrorMessage()).toBeNull();
    expect(component.isScanning()).toBe(true);
  });

  describe('auto reset after a logged listen (#351)', () => {
    const logged: ScanResult = {
      success: true,
      message: 'Now playing: Abbey Road',
      record: { discogsId: 100, title: 'Abbey Road', artist: 'The Beatles', thumbUrl: 'http://thumb.jpg' },
    };

    beforeEach(() => {
      vi.useFakeTimers();
      component.scannerService.setScannerMode('hardware');
      apiServiceMock.scanBarcode.mockReturnValue(of(logged));
    });

    it('keeps the record visible before 30 seconds have passed', async () => {
      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS - 1);

      expect(component.scanResult()).toEqual(logged);
    });

    it('shows the normal scan screen again after 30 seconds', async () => {
      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS);

      expect(component.scanResult()).toBeNull();
      expect(component.isScanning()).toBe(true);
    });

    it('uses the display duration configured in the settings (#366)', async () => {
      component.scannerService.setResultDisplaySeconds(5);
      await component.executeBarcodeScan('075678645624');

      await vi.advanceTimersByTimeAsync(4_999);
      expect(component.scanResult()).toEqual(logged);

      await vi.advanceTimersByTimeAsync(1);
      expect(component.scanResult()).toBeNull();
      expect(component.isScanning()).toBe(true);
    });

    it('restarts the countdown when another record is scanned', async () => {
      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS - 5_000);
      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS - 1);

      expect(component.scanResult()).toEqual(logged);
      await vi.advanceTimersByTimeAsync(1);
      expect(component.scanResult()).toBeNull();
    });

    it('cancels the countdown when the user resets manually', async () => {
      await component.executeBarcodeScan('075678645624');
      expect(vi.getTimerCount()).toBe(1);

      component.handleReset();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start the camera on a destroyed screen after an automatic reset', async () => {
      component.scannerService.setScannerMode('camera');
      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS);
      fixture.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind when the screen is destroyed', async () => {
      await component.executeBarcodeScan('075678645624');
      fixture.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps results that need a decision on screen', async () => {
      const notFound: ScanResult = {
        success: false,
        message: 'Found on Discogs',
        discogsMatches: [{ id: 501, title: 'Dark Side', year: '1973', thumbUrl: '', format: ['Vinyl'], country: 'UK' }],
      };
      apiServiceMock.scanBarcode.mockReturnValue(of(notFound));

      await component.executeBarcodeScan('075678645624');
      await vi.advanceTimersByTimeAsync(SCAN_RESULT_DISPLAY_MS * 2);

      expect(component.scanResult()).toEqual(notFound);
    });
  });

  it('should display hardware scanner status when scannerMode is hardware', () => {
    const scannerService = TestBed.inject(ScannerService);
    scannerService.setScannerMode('hardware');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Eyoyo EY-009P');
    expect(compiled.querySelector('#reader')).toBeNull();
  });

  it('should react to scanTrigger from ScannerService', async () => {
    vi.useFakeTimers();
    const scannerService = component.scannerService;
    vi.spyOn(component, 'executeBarcodeScan');
    const mockResult: ScanResult = { success: true, message: 'Scan OK' };
    apiServiceMock.scanBarcode.mockReturnValue(of(mockResult));

    scannerService.scanTrigger.set({ code: '075678645624', timestamp: Date.now() });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.executeBarcodeScan).toHaveBeenCalledWith('075678645624');
    expect(component.isScanning()).toBe(false);
  });

  it('does not process the last scan again when the scanner is created again', async () => {
    vi.useFakeTimers();
    const scannerService = component.scannerService;
    scannerService.setScannerMode('hardware');
    apiServiceMock.scanBarcode.mockReturnValue(of({ success: true, message: 'Scan OK' } as ScanResult));

    scannerService.scanTrigger.set({ code: '075678645624', timestamp: Date.now() });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(apiServiceMock.scanBarcode).toHaveBeenCalledTimes(1);
    expect(scannerService.scanTrigger()).toBeNull();

    // Closing and opening the scanner creates the component again
    fixture.destroy();
    const reopened = TestBed.createComponent(BarcodeScannerComponent);
    reopened.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(apiServiceMock.scanBarcode).toHaveBeenCalledTimes(1);

    // The re-created scanner still handles the next real scan
    scannerService.scanTrigger.set({ code: '075678645625', timestamp: Date.now() });
    reopened.detectChanges();
    await vi.advanceTimersByTimeAsync(0);

    expect(apiServiceMock.scanBarcode).toHaveBeenCalledTimes(2);
    expect(apiServiceMock.scanBarcode).toHaveBeenLastCalledWith('075678645625', false);
    reopened.destroy();
  });

  describe('identify mode', () => {
    const found: ScanResult = {
      success: true,
      message: 'Found: Abbey Road',
      record: { discogsId: 100, title: 'Abbey Road', artist: 'The Beatles', thumbUrl: 't.jpg' },
    };

    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('toggles the mode with the switch', () => {
      fixture.detectChanges();
      const toggle = fixture.nativeElement.querySelector('[data-testid="identify-toggle"]') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      toggle.click();
      fixture.detectChanges();
      expect(component.scannerService.identifyMode()).toBe(true);
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    it('hands the found record to the host without a success card and stays ready', async () => {
      component.scannerService.setIdentifyMode(true);
      apiServiceMock.scanBarcode.mockReturnValue(of(found));
      const identified = vi.fn();
      component.identified.subscribe(identified);
      const logged = component.scannerService.scanLogged();

      await component.executeBarcodeScan('4006381333931');

      expect(apiServiceMock.scanBarcode).toHaveBeenCalledWith('4006381333931', true);
      expect(identified).toHaveBeenCalledWith({ discogsId: 100, title: 'Abbey Road', artist: 'The Beatles', thumbUrl: 't.jpg' });
      expect(component.scanResult()).toBeNull();
      expect(component.isScanning()).toBe(true);
      expect(component.scannerService.scanLogged()).toBe(logged);
    });

    it('handles a response by the mode it was requested with', async () => {
      let respond!: (r: ScanResult) => void;
      apiServiceMock.scanBarcode.mockReturnValue(
        new Observable<ScanResult>((sub) => { respond = (r) => { sub.next(r); sub.complete(); }; }),
      );
      const identified = vi.fn();
      component.identified.subscribe(identified);

      const pending = component.executeBarcodeScan('4006381333931');
      component.scannerService.setIdentifyMode(true);
      respond({ ...found, message: 'Now playing: Abbey Road' });
      await pending;

      expect(identified).not.toHaveBeenCalled();
      expect(component.scanResult()?.success).toBe(true);
    });

    it('does not hand over a record outside the identify mode', async () => {
      apiServiceMock.scanBarcode.mockReturnValue(of({ ...found, message: 'Now playing: Abbey Road' }));
      const identified = vi.fn();
      component.identified.subscribe(identified);

      await component.executeBarcodeScan('4006381333931');

      expect(apiServiceMock.scanBarcode).toHaveBeenCalledWith('4006381333931', false);
      expect(identified).not.toHaveBeenCalled();
      expect(component.scanResult()?.success).toBe(true);
    });

    it('shows Discogs matches for a record that is not in the collection', async () => {
      component.scannerService.setIdentifyMode(true);
      const match = { id: 7, title: 'Other', year: '1970', thumbUrl: '', coverImage: '', format: [], country: 'DE' };
      apiServiceMock.scanBarcode.mockReturnValue(of({ success: false, message: 'found on Discogs', discogsMatches: [match] }));
      const identified = vi.fn();
      component.identified.subscribe(identified);

      await component.executeBarcodeScan('4006381333931');

      expect(identified).not.toHaveBeenCalled();
      expect(component.scanResult()?.discogsMatches?.length).toBe(1);
    });
  });

  it('offers a manual record with the scanned barcode when nothing was found', async () => {
    apiServiceMock.scanBarcode.mockReturnValue(of({ success: false, message: 'Release not found in collection or invalid barcode.' }));
    await component.executeBarcodeScan('4006381333931');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="scanner-add-manual"]') as HTMLButtonElement).click();
    expect(component.manualPrefill()).toEqual({ barcode: '4006381333931' });

    // A title search is no barcode
    component.manualPrefill.set(null);
    await component.executeBarcodeScan('Die Sterne Posen');
    component.openManualForm();
    expect(component.manualPrefill()).toEqual({ barcode: null });
  });
});
