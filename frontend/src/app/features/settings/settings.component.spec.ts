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
import { APP_VERSION } from '../../core/constants/release-info.data';

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
      updateDiscogs: vi.fn().mockName('updateDiscogs').mockResolvedValue(undefined),
      performSync: vi.fn().mockName('performSync'),
      resetAllListens: vi.fn().mockName('resetAllListens').mockResolvedValue(undefined),
      logout: vi.fn().mockName('logout').mockResolvedValue(undefined),
    };

    mockApiService = {
      getRoonStatus: vi.fn().mockName('getRoonStatus').mockReturnValue(of(mockRoonStatus)),
      getRoonZones: vi.fn().mockName('getRoonZones').mockReturnValue(of(mockRoonStatus.zones)),
      updateRoonSettings: vi.fn().mockName('updateRoonSettings').mockReturnValue(of(mockRoonStatus)),
      downloadQrCodes: vi.fn().mockName('downloadQrCodes').mockReturnValue(of(new Blob())),
      exportCollection: vi.fn().mockName('exportCollection').mockReturnValue(of(new Blob(['test'], { type: 'text/csv' }))),
    };

    mockThemeService = {
      theme: signal('dark'),
      setTheme: vi.fn().mockName('setTheme'),
    };

    mockLanguageService = {
      language: signal('de'),
      setLanguage: vi.fn().mockName('setLanguage'),
      translate: (key: string) => key,
    };

    mockToastService = {
      showToast: vi.fn().mockName('showToast'),
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
    expect(component.isSavingRoon()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Roon-Einstellungen gespeichert!', 'success');
  });

  it('should handle error when saving Roon settings fails', () => {
    mockApiService.updateRoonSettings.mockReturnValue(throwError(() => new Error('Save error')));

    component.handleSaveRoon();

    expect(component.isSavingRoon()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Fehler beim Speichern der Roon-Einstellungen', 'error');
  });

  it('should refresh Roon zones', () => {
    const updatedZones = [{ zoneId: 'z3', name: 'Garden', state: 'stopped' }];
    mockApiService.getRoonZones.mockReturnValue(of(updatedZones));

    component.handleRefreshZones();

    expect(mockApiService.getRoonZones).toHaveBeenCalled();
    expect(component.isLoadingZones()).toBe(false);
    expect(component.roonStatus()?.zones).toEqual(updatedZones);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Roon-Zonen aktualisiert', 'success');
  });

  it('should download QR codes when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(component as any, 'downloadBlob').mockImplementation(() => { });

    await component.handleDownloadQrCodes();

    expect(mockApiService.downloadQrCodes).toHaveBeenCalled();
    expect(component.isDownloadingQr()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith('QR codes generated successfully', 'success');
  });

  it('should not download QR codes when confirmation cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.handleDownloadQrCodes();

    expect(mockApiService.downloadQrCodes).not.toHaveBeenCalled();
    expect(component.isDownloadingQr()).toBe(false);
  });

  it('should handle error during QR code download', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApiService.downloadQrCodes.mockReturnValue(throwError(() => new Error('Download failed')));

    await component.handleDownloadQrCodes();

    expect(component.isDownloadingQr()).toBe(false);
    expect(mockToastService.showToast).toHaveBeenCalledWith('Download failed', 'error');
  });

  it('should allow changing scanner mode and sound feedback', () => {
    component.scannerService.setScannerMode('hybrid');
    expect(component.scannerService.scannerMode()).toBe('hybrid');

    component.scannerService.setSoundFeedback(false);
    expect(component.scannerService.soundFeedback()).toBe(false);
  });

  it('should display and clear scanner test result', () => {
    component.scannerService.processHardwareScan('075678645624');
    expect(component.scannerService.lastScannedCode()?.code).toBe('075678645624');

    component.scannerService.clearLastScannedCode();
    expect(component.scannerService.lastScannedCode()).toBeNull();
  });

  it('should show the current app version on the release notes tab', () => {
    const badges = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('button span'));
    expect(badges.some((el) => el.textContent?.trim() === `v${APP_VERSION}`)).toBe(true);
  });

  it('should switch tabs and render the release notes / changes section', () => {
    // Initial state: settings tab active
    expect(component.activeTab()).toBe('settings');
    expect(fixture.nativeElement.querySelector('app-release-notes')).toBeNull();

    // Switch to changes tab
    component.activeTab.set('changes');
    fixture.detectChanges();

    const releaseNotes = fixture.nativeElement.querySelector('app-release-notes');
    expect(releaseNotes).toBeTruthy();

    // Switch back to settings tab
    component.activeTab.set('settings');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-release-notes')).toBeNull();
  });

  it('should export collection in specified format', async () => {
    vi.spyOn(component as any, 'downloadBlob').mockImplementation(() => { });

    await component.handleExportCollection('pdf');

    expect(mockApiService.exportCollection).toHaveBeenCalledWith('pdf');
    expect(component.isExporting()).toBeNull();
    expect(mockToastService.showToast).toHaveBeenCalledWith('settings.exportSuccess', 'success');
  });

  it('should handle error during collection export', async () => {
    mockApiService.exportCollection.mockReturnValue(throwError(() => new Error('Export error')));

    await component.handleExportCollection('csv');

    expect(component.isExporting()).toBeNull();
    expect(mockToastService.showToast).toHaveBeenCalledWith('Export error', 'error');
  });
});
