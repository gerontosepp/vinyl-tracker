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
import { RestoreResult, RoonStatus } from '../../core/types';
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

  const mockRestoreResult: RestoreResult = {
    format_version: 2,
    records_total: 2,
    records_added: 1,
    records_updated: 1,
    listens_added: 3,
    listens_skipped: 0,
    listen_history_included: true,
  };

  const backupFile = (content: string, name = 'vinyl_collection_backup.json'): File =>
    new File([content], name, { type: 'application/json' });

  /** Simulates choosing a file in the hidden restore input. */
  const selectRestoreFile = async (file: File | null): Promise<HTMLInputElement> => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="restore-file-input"]');
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    await component.handleRestoreFileSelected({ target: input } as unknown as Event);
    fixture.detectChanges();
    return input;
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
      exportCollection: vi.fn().mockName('exportCollection').mockReturnValue(of(new Blob(['test'], { type: 'text/csv' }))),
      restoreCollection: vi.fn().mockName('restoreCollection').mockReturnValue(of(mockRestoreResult)),
      // CD count requested by the print dialog
      getCollection: vi.fn().mockName('getCollection').mockReturnValue(
        of({ releases: [], pagination: { page: 1, pages: 1, per_page: 1, items: 0 } })
      ),
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

  it('opens the print dialog for the whole collection and closes it again', () => {
    expect(fixture.nativeElement.querySelector('app-print-dialog')).toBeNull();

    fixture.nativeElement.querySelector('[data-testid="open-print-dialog"]').click();
    fixture.detectChanges();

    const dialog = fixture.debugElement.query((el) => el.name === 'app-print-dialog');
    expect(dialog).not.toBeNull();
    // No selection or filter: the dialog offers the whole collection only
    expect(dialog.componentInstance.scopes()).toEqual(['all']);

    dialog.componentInstance.closed.emit();
    fixture.detectChanges();
    expect(component.showPrintDialog()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-print-dialog')).toBeNull();
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

  describe('restore from JSON backup', () => {
    const backup = { format_version: 2, releases: [{ id: 1 }, { id: 2 }] };

    it('opens the file picker from the restore button', () => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="restore-file-input"]');
      const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => { });

      fixture.nativeElement.querySelector('[data-testid="restore-button"]').click();

      expect(clickSpy).toHaveBeenCalled();
      expect(input.accept).toContain('.json');
    });

    it('asks for confirmation with file name and record count before restoring', async () => {
      const input = await selectRestoreFile(backupFile(JSON.stringify(backup)));

      expect(input.value).toBe('');
      expect(component.pendingRestore()).toEqual({
        fileName: 'vinyl_collection_backup.json',
        count: 2,
        backup,
      });
      expect(fixture.nativeElement.querySelector('[data-testid="restore-confirm"]')).not.toBeNull();
      expect(mockApiService.restoreCollection).not.toHaveBeenCalled();
    });

    it('does nothing when the file dialog is cancelled', async () => {
      await selectRestoreFile(null);

      expect(component.pendingRestore()).toBeNull();
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });

    it.each([
      ['invalid JSON', '{ not json'],
      ['JSON without releases', '{"username":"x"}'],
      ['JSON null', 'null'],
    ])('rejects %s without calling the API', async (_label, content) => {
      await selectRestoreFile(backupFile(content));

      expect(component.pendingRestore()).toBeNull();
      expect(mockToastService.showToast).toHaveBeenCalledWith('settings.restoreInvalid', 'error');
      expect(mockApiService.restoreCollection).not.toHaveBeenCalled();
    });

    it('cancelling the confirmation keeps the collection untouched', async () => {
      await selectRestoreFile(backupFile(JSON.stringify(backup)));

      component.pendingRestore.set(null);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="restore-confirm"]')).toBeNull();
      expect(mockApiService.restoreCollection).not.toHaveBeenCalled();
    });

    it('restores the backup after confirmation and reports the result', async () => {
      await selectRestoreFile(backupFile(JSON.stringify(backup)));

      await component.confirmRestore();

      expect(mockApiService.restoreCollection).toHaveBeenCalledWith(backup);
      expect(component.pendingRestore()).toBeNull();
      expect(component.isRestoring()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith('settings.restoreSuccess', 'success');
      expect(mockToastService.showToast).not.toHaveBeenCalledWith('settings.restoreNoHistory', 'info');
    });

    it('hints that listen counts were not restored from an old backup', async () => {
      mockApiService.restoreCollection.mockReturnValue(
        of({ ...mockRestoreResult, format_version: 1, listens_added: 0, listen_history_included: false })
      );
      await selectRestoreFile(backupFile(JSON.stringify(backup)));

      await component.confirmRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith('settings.restoreSuccess', 'success');
      expect(mockToastService.showToast).toHaveBeenCalledWith('settings.restoreNoHistory', 'info');
    });

    it('shows the backend error when the restore fails', async () => {
      mockApiService.restoreCollection.mockReturnValue(throwError(() => new Error('Invalid backup entry #2')));
      await selectRestoreFile(backupFile(JSON.stringify(backup)));

      await component.confirmRestore();

      expect(component.isRestoring()).toBe(false);
      expect(mockToastService.showToast).toHaveBeenCalledWith('Invalid backup entry #2', 'error');
    });

    it('confirmRestore without a pending backup is a no-op', async () => {
      await component.confirmRestore();

      expect(mockApiService.restoreCollection).not.toHaveBeenCalled();
    });
  });
});
