import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { of, throwError } from 'rxjs';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RoonStatus } from '../../core/types';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let mockAuthService: any;
  let mockApiService: any;
  let mockThemeService: any;
  let mockLanguageService: any;
  let mockToastService: any;

  const mockRoonStatus: RoonStatus = {
    connected: true,
    paired: true,
    coreName: 'My Roon Core',
    coreId: 'core-1',
    zones: [
      { zoneId: 'z1', name: 'Living Room', state: 'playing' },
      { zoneId: 'z2', name: 'Kitchen', state: 'stopped' },
    ],
  };

  beforeEach(async () => {
    mockAuthService = {
      user: signal({
        id: 1,
        username: 'testuser',
        discogsUsername: 'discogs_user',
        roonHost: '192.168.1.50',
        roonPort: 9100,
        roonZoneId: 'z1',
      }),
      isLoading: signal(false),
      isSyncing: signal(false),
      updateDiscogs: jasmine.createSpy('updateDiscogs').and.returnValue(Promise.resolve()),
      performSync: jasmine.createSpy('performSync'),
      resetAllListens: jasmine.createSpy('resetAllListens').and.returnValue(Promise.resolve()),
      logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
    };

    mockApiService = {
      getRoonStatus: jasmine.createSpy('getRoonStatus').and.returnValue(of(mockRoonStatus)),
      getRoonZones: jasmine.createSpy('getRoonZones').and.returnValue(of(mockRoonStatus.zones)),
      updateRoonSettings: jasmine.createSpy('updateRoonSettings').and.returnValue(of(mockRoonStatus)),
      downloadQrCodes: jasmine.createSpy('downloadQrCodes').and.returnValue(of(new Blob())),
    };

    mockThemeService = {
      theme: signal('dark'),
      setTheme: jasmine.createSpy('setTheme'),
    };

    mockLanguageService = {
      language: signal('de'),
      setLanguage: jasmine.createSpy('setLanguage'),
      translate: (key: string) => key,
    };

    mockToastService = {
      showToast: jasmine.createSpy('showToast'),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ApiService, useValue: mockApiService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: LanguageService, useValue: mockLanguageService },
        { provide: ToastService, useValue: mockToastService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load initial Roon status', () => {
    expect(component).toBeTruthy();
    expect(mockApiService.getRoonStatus).toHaveBeenCalled();
    expect(component.roonStatus()).toEqual(mockRoonStatus);
    expect(component.roonHost).toBe('192.168.1.50');
  });

  it('should save Roon settings successfully', () => {
    component.roonHost = '192.168.1.99';
    component.roonPort = 9100;
    component.roonZoneId = 'z1';

    component.handleSaveRoon();

    expect(mockApiService.updateRoonSettings).toHaveBeenCalledWith({
      roonHost: '192.168.1.99',
      roonPort: 9100,
      roonZoneId: 'z1',
      roonZoneName: 'Living Room',
    });
    expect(component.isSavingRoon()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Roon-Einstellungen gespeichert!',
      'success'
    );
  });

  it('should handle error when saving Roon settings fails', () => {
    mockApiService.updateRoonSettings.and.returnValue(throwError(() => new Error('Save error')));

    component.handleSaveRoon();

    expect(component.isSavingRoon()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'Fehler beim Speichern der Roon-Einstellungen',
      'error'
    );
  });

  it('should refresh Roon zones', () => {
    const updatedZones = [{ zoneId: 'z3', name: 'Garden', state: 'stopped' }];
    mockApiService.getRoonZones.and.returnValue(of(updatedZones));

    component.handleRefreshZones();

    expect(mockApiService.getRoonZones).toHaveBeenCalled();
    expect(component.isLoadingZones()).toBeFalse();
    expect(component.roonStatus()?.zones).toEqual(updatedZones);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Roon-Zonen aktualisiert', 'success');
  });

  it('should download QR codes when confirmed', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn<any>(component, 'downloadBlob').and.callFake(() => {});

    await component.handleDownloadQrCodes();

    expect(mockApiService.downloadQrCodes).toHaveBeenCalled();
    expect(component.isDownloadingQr()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      'QR codes generated successfully',
      'success'
    );
  });

  it('should not download QR codes when confirmation cancelled', async () => {
    spyOn(window, 'confirm').and.returnValue(false);

    await component.handleDownloadQrCodes();

    expect(mockApiService.downloadQrCodes).not.toHaveBeenCalled();
    expect(component.isDownloadingQr()).toBeFalse();
  });

  it('should handle error during QR code download', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    mockApiService.downloadQrCodes.and.returnValue(throwError(() => new Error('Download failed')));

    await component.handleDownloadQrCodes();

    expect(component.isDownloadingQr()).toBeFalse();
    expect(mockToastService.showToast).toHaveBeenCalledWith('Download failed', 'error');
  });

  it('should allow changing scanner mode and sound feedback', () => {
    component.scannerService.setScannerMode('hybrid');
    expect(component.scannerService.scannerMode()).toBe('hybrid');

    component.scannerService.setSoundFeedback(false);
    expect(component.scannerService.soundFeedback()).toBeFalse();
  });

  it('should display and clear scanner test result', () => {
    component.scannerService.processHardwareScan('075678645624');
    expect(component.scannerService.lastScannedCode()?.code).toBe('075678645624');

    component.scannerService.clearLastScannedCode();
    expect(component.scannerService.lastScannedCode()).toBeNull();
  });
});
