import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BarcodeScannerComponent } from './barcode-scanner.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { User, ScanResult, SyncResult } from '../../../core/types';

describe('BarcodeScannerComponent', () => {
  let component: BarcodeScannerComponent;
  let fixture: ComponentFixture<BarcodeScannerComponent>;
  let apiServiceMock: jasmine.SpyObj<ApiService>;
  let toastServiceMock: jasmine.SpyObj<ToastService>;
  let authServiceMock: { user: jasmine.Spy };

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    discogsUsername: 'discogsuser',
  };

  beforeEach(async () => {
    apiServiceMock = jasmine.createSpyObj('ApiService', [
      'scanBarcode',
      'addReleaseToCollection',
      'getProxiedImageUrl',
    ]);
    apiServiceMock.getProxiedImageUrl.and.callFake((url: string) => url);

    toastServiceMock = jasmine.createSpyObj('ToastService', ['showToast']);

    authServiceMock = {
      user: jasmine.createSpy('user').and.returnValue(mockUser),
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

  it('should add release to Discogs and show success state', fakeAsync(() => {
    const syncResult: SyncResult = { added: 1, removed: 0 };
    apiServiceMock.addReleaseToCollection.and.returnValue(of(syncResult));

    component.addToDiscogs(501);
    tick();

    expect(apiServiceMock.addReleaseToCollection).toHaveBeenCalledWith(501);
    expect(component.addSuccessMessage()).toContain('Platte erfolgreich zu Discogs hinzugefügt');
    expect(toastServiceMock.showToast).toHaveBeenCalledWith(
      'Erfolgreich zu deiner Discogs-Sammlung hinzugefügt!',
      'success'
    );
    expect(component.isAddingToCollection()).toBeFalse();
  }));

  it('should handle error when adding release to Discogs fails', fakeAsync(() => {
    apiServiceMock.addReleaseToCollection.and.returnValue(
      throwError(() => ({ error: { message: 'Discogs rate limit reached' } }))
    );

    component.addToDiscogs(501);
    tick();

    expect(component.addErrorMessage()).toBe('Discogs rate limit reached');
    expect(toastServiceMock.showToast).toHaveBeenCalledWith(
      'Discogs rate limit reached',
      'error'
    );
    expect(component.isAddingToCollection()).toBeFalse();
  }));

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
    expect(component.isScanning()).toBeTrue();
  });

  it('should display hardware scanner status when scannerMode is hardware', () => {
    const scannerService = TestBed.inject(ScannerService);
    scannerService.setScannerMode('hardware');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Eyoyo EY-009P');
    expect(compiled.querySelector('#reader')).toBeNull();
  });

  it('should react to scanTrigger from ScannerService', fakeAsync(() => {
    const scannerService = component.scannerService;
    spyOn(component, 'executeBarcodeScan').and.callThrough();
    const mockResult: ScanResult = { success: true, message: 'Scan OK' };
    apiServiceMock.scanBarcode.and.returnValue(of(mockResult));

    scannerService.scanTrigger.set({ code: '075678645624', timestamp: Date.now() });
    fixture.detectChanges();
    tick();

    expect(component.executeBarcodeScan).toHaveBeenCalledWith('075678645624');
    expect(component.isScanning()).toBeFalse();
  }));
});
