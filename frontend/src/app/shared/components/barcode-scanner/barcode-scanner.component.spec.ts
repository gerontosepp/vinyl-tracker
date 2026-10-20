import type { Mock, MockedObject } from "vitest";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarcodeScannerComponent } from './barcode-scanner.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { User, ScanResult, SyncResult } from '../../../core/types';

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
    apiServiceMock = {
      scanBarcode: vi.fn().mockName("ApiService.scanBarcode"),
      addReleaseToCollection: vi.fn().mockName("ApiService.addReleaseToCollection"),
      getProxiedImageUrl: vi.fn().mockName("ApiService.getProxiedImageUrl")
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
});
