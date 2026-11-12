import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ScannerService, SCAN_RESULT_DISPLAY_DEFAULT_SECONDS, SCAN_RESULT_DISPLAY_MAX_SECONDS, SCAN_RESULT_DISPLAY_MIN_SECONDS, clampResultDisplaySeconds } from './scanner.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';

const loggedRecord = { discogsId: 42, title: 'Kind of Blue', artist: 'Miles Davis', thumbUrl: '' };

describe('ScannerService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  let service: ScannerService;
  let mockRouter: any;
  let mockApiService: any;

  beforeEach(() => {
    localStorage.clear();
    mockRouter = {
      events: {
        pipe: () => ({
          subscribe: () => ({ unsubscribe: () => { } }),
        }),
      },
      url: '/',
      navigate: vi.fn().mockName('navigate').mockResolvedValue(true),
    };
    mockApiService = {
      scanBarcode: vi.fn().mockName('scanBarcode').mockReturnValue(of({ success: true, message: 'logged', record: loggedRecord })),
    };

    TestBed.configureTestingModule({
      providers: [
        ScannerService,
        { provide: Router, useValue: mockRouter },
        { provide: ApiService, useValue: mockApiService },
      ],
    });
    service = TestBed.inject(ScannerService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should toggle showScanner state', () => {
    expect(service.showScanner()).toBe(false);
    service.openScanner();
    expect(service.showScanner()).toBe(true);
    service.closeScanner();
    expect(service.showScanner()).toBe(false);
  });

  it('drops a pending scan when the scanner is closed', () => {
    service.scanTrigger.set({ code: '075678645624', timestamp: 1 });

    service.closeScanner();

    expect(service.scanTrigger()).toBeNull();
  });

  it('should toggleScanner correctly', () => {
    expect(service.showScanner()).toBe(false);
    service.toggleScanner();
    expect(service.showScanner()).toBe(true);
    service.toggleScanner();
    expect(service.showScanner()).toBe(false);
  });

  it('should notify scan logged', () => {
    expect(service.scanLogged()).toBe(0);
    service.notifyScanLogged();
    expect(service.scanLogged()).toBe(1);
  });

  it('should manage scanner modes and persist to localStorage', () => {
    expect(service.scannerMode()).toBe('hardware');

    service.setScannerMode('camera');
    expect(service.scannerMode()).toBe('camera');
    expect(localStorage.getItem('scanner_mode')).toBe('camera');

    service.setScannerMode('hybrid');
    expect(service.scannerMode()).toBe('hybrid');
    expect(localStorage.getItem('scanner_mode')).toBe('hybrid');
  });

  it('should manage sound feedback preference', () => {
    expect(service.soundFeedback()).toBe(true);

    service.setSoundFeedback(false);
    expect(service.soundFeedback()).toBe(false);
    expect(localStorage.getItem('scanner_sound')).toBe('false');

    service.setSoundFeedback(true);
    expect(service.soundFeedback()).toBe(true);
    expect(localStorage.getItem('scanner_sound')).toBe('true');
  });

  it('should manage the identify mode preference', () => {
    expect(service.identifyMode()).toBe(false);

    service.setIdentifyMode(true);
    expect(service.identifyMode()).toBe(true);
    expect(localStorage.getItem('scanner_identify')).toBe('true');

    service.setIdentifyMode(false);
    expect(localStorage.getItem('scanner_identify')).toBe('false');
  });

  describe('result display duration (#366)', () => {
    it('defaults to 30 seconds', () => {
      expect(service.resultDisplaySeconds()).toBe(SCAN_RESULT_DISPLAY_DEFAULT_SECONDS);
      expect(service.resultDisplayMs()).toBe(30_000);
    });

    it('persists the chosen duration to localStorage', () => {
      service.setResultDisplaySeconds(45);

      expect(service.resultDisplaySeconds()).toBe(45);
      expect(service.resultDisplayMs()).toBe(45_000);
      expect(localStorage.getItem('scanner_result_display_seconds')).toBe('45');
    });

    it('loads the saved duration on startup', () => {
      localStorage.setItem('scanner_result_display_seconds', '60');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [ScannerService, { provide: Router, useValue: mockRouter }],
      });
      const reloaded = TestBed.inject(ScannerService);

      expect(reloaded.resultDisplaySeconds()).toBe(60);
    });

    it('falls back to the default for an invalid stored value', () => {
      localStorage.setItem('scanner_result_display_seconds', 'abc');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [ScannerService, { provide: Router, useValue: mockRouter }],
      });
      const reloaded = TestBed.inject(ScannerService);

      expect(reloaded.resultDisplaySeconds()).toBe(SCAN_RESULT_DISPLAY_DEFAULT_SECONDS);
    });

    it('clamps to the supported range and rounds to whole seconds', () => {
      expect(clampResultDisplaySeconds(1)).toBe(SCAN_RESULT_DISPLAY_MIN_SECONDS);
      expect(clampResultDisplaySeconds(500)).toBe(SCAN_RESULT_DISPLAY_MAX_SECONDS);
      expect(clampResultDisplaySeconds(12.6)).toBe(13);
      expect(clampResultDisplaySeconds(Number.NaN)).toBe(SCAN_RESULT_DISPLAY_DEFAULT_SECONDS);
    });

    it('clamps values passed to the setter', () => {
      service.setResultDisplaySeconds(1);
      expect(service.resultDisplaySeconds()).toBe(SCAN_RESULT_DISPLAY_MIN_SECONDS);

      service.setResultDisplaySeconds(500);
      expect(service.resultDisplaySeconds()).toBe(SCAN_RESULT_DISPLAY_MAX_SECONDS);
      expect(localStorage.getItem('scanner_result_display_seconds')).toBe('120');
    });
  });

  it('should capture fast HID scanner burst as a 1D barcode scan', () => {
    service.setScannerMode('hardware');
    const barcode = '075678645624';

    // Simulate fast keystrokes (< 50ms)
    for (const char of barcode) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: char }));
    }
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    vi.spyOn(enterEvent, 'preventDefault').mockReturnValue(undefined);

    service.handleKeyDown(enterEvent);

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    const lastCode = service.lastScannedCode();
    expect(lastCode).toBeTruthy();
    expect(lastCode?.code).toBe(barcode);
    expect(lastCode?.type).toBe('1d');
  });

  it('hands out a pending scan trigger only once', () => {
    service.scanTrigger.set({ code: '075678645624', timestamp: 1 });

    expect(service.consumeScanTrigger()?.code).toBe('075678645624');
    expect(service.scanTrigger()).toBeNull();
    expect(service.consumeScanTrigger()).toBeNull();
  });

  it('should warn when a keystroke burst outside inputs is dropped', () => {
    service.setScannerMode('hardware');
    const toast = TestBed.inject(ToastService);
    const showToast = vi.spyOn(toast, 'showToast');

    // Mobile keyboard that never reports a usable key
    for (let i = 0; i < 12; i++) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Unidentified' }));
    }
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(showToast).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(service.lastScannedCode()).toBeNull();
  });

  it('should not warn for an accepted scan or a lone Enter', () => {
    service.setScannerMode('hardware');
    const showToast = vi.spyOn(TestBed.inject(ToastService), 'showToast');

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    for (const char of '075678645624') {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: char }));
    }
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(showToast).not.toHaveBeenCalled();
  });

  it('should not warn for slow typing inside an input field', () => {
    vi.useFakeTimers();
    service.setScannerMode('hardware');
    const showToast = vi.spyOn(TestBed.inject(ToastService), 'showToast');
    const input = document.createElement('input');

    // ~100 ms per key: too slow for a scanner in an input, so the burst is rejected
    for (const char of 'abcd') {
      service.handleKeyDown({ key: char } as KeyboardEvent);
      vi.advanceTimersByTime(100);
    }
    service.handleKeyDown({ key: 'Enter', target: input } as unknown as KeyboardEvent);

    expect(service.lastScannedCode()).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('should only count keys that follow each other closely', () => {
    vi.useFakeTimers();
    service.setScannerMode('hardware');
    const showToast = vi.spyOn(TestBed.inject(ToastService), 'showToast');

    for (let i = 0; i < 3; i++) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Unidentified' }));
      vi.advanceTimersByTime(600);
    }
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(showToast).not.toHaveBeenCalled();
  });

  it('should recognize 2D QR Code when format is discogs-id', () => {
    service.setScannerMode('hardware');
    const qrPayload = 'discogs-id:123456';

    for (const char of qrPayload) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: char }));
    }
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    service.handleKeyDown(enterEvent);

    const lastCode = service.lastScannedCode();
    expect(lastCode).toBeTruthy();
    expect(lastCode?.code).toBe(qrPayload);
    expect(lastCode?.type).toBe('2d');
  });

  it('should ignore keyboard events if scannerMode is camera only', () => {
    service.setScannerMode('camera');
    const barcode = '075678645624';

    for (const char of barcode) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key: char }));
    }
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    service.handleKeyDown(enterEvent);

    expect(service.lastScannedCode()).toBeNull();
  });

  it('should ignore modifier keys like Shift or Control', () => {
    service.setScannerMode('hardware');
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Control' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(service.lastScannedCode()).toBeNull();
  });

  it('should clear last scanned code when clearLastScannedCode is called', () => {
    service.processHardwareScan('123456789');
    expect(service.lastScannedCode()).toBeTruthy();

    service.clearLastScannedCode();
    expect(service.lastScannedCode()).toBeNull();
  });

  it('should not navigate away if on settings page when scan is received', () => {
    mockRouter.url = '/settings';
    service.processHardwareScan('075678645624');

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(service.lastScannedCode()?.code).toBe('075678645624');
  });

  it('should not navigate away if on profile page (settings) when scan is received', () => {
    mockRouter.url = '/profile';
    service.processHardwareScan('075678645624');

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(service.lastScannedCode()?.code).toBe('075678645624');
  });

  it('logs a scan on the current page and shows the widget instead of navigating', async () => {
    mockRouter.url = '/collection';
    service.processHardwareScan('075678645624');

    await vi.waitFor(() => expect(service.nowPlaying()?.discogsId).toBe(42));
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(service.showScanner()).toBe(false);
    expect(service.scanLogged()).toBe(1);
  });

  it('opens the scanner when a pressing must be chosen', async () => {
    mockApiService.scanBarcode.mockReturnValue(
      of({
        success: false,
        message: 'choose',
        discogsMatches: [{ id: 7, title: 'Blue', year: '1959' }],
      }),
    );
    mockRouter.url = '/collection';
    service.processHardwareScan('075678645624');

    await vi.waitFor(() => expect(service.showScanner()).toBe(true));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    expect(service.scanTrigger()?.code).toBe('075678645624');
    expect(service.nowPlaying()).toBeNull();
  });

  it('opens the scanner in identify mode without a widget', async () => {
    service.setIdentifyMode(true);
    mockRouter.url = '/collection';
    service.processHardwareScan('075678645624');

    await vi.waitFor(() => expect(service.showScanner()).toBe(true));
    expect(service.nowPlaying()).toBeNull();
    expect(mockApiService.scanBarcode).toHaveBeenCalledWith('075678645624', true);
  });

  it('reports a failed scan without matches as a toast and stays put', async () => {
    mockApiService.scanBarcode.mockReturnValue(of({ success: false, message: 'Netzwerkfehler' }));
    const toast = TestBed.inject(ToastService);
    const shown = vi.spyOn(toast, 'showToast');
    mockRouter.url = '/collection';
    service.processHardwareScan('075678645624');

    await vi.waitFor(() => expect(shown).toHaveBeenCalledWith('Netzwerkfehler', 'error'));
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(service.showScanner()).toBe(false);
  });

  it('lets the scanner screen handle a scan while it is open', () => {
    service.openScanner();
    service.processHardwareScan('075678645624');

    expect(service.scanTrigger()?.code).toBe('075678645624');
    expect(mockApiService.scanBarcode).not.toHaveBeenCalled();
  });

  it('consumes a record detail request only once', () => {
    service.requestRecordDetail(loggedRecord);

    expect(service.nowPlaying()).toBeNull();
    expect(service.consumePendingRecordDetail()).toEqual(loggedRecord);
    expect(service.consumePendingRecordDetail()).toBeNull();
  });

  it('dismisses a visible widget when the scanner opens', () => {
    service.nowPlaying.set(loggedRecord);

    service.openScanner();

    expect(service.nowPlaying()).toBeNull();
  });

  it('ignores a slower response of an earlier scan', async () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    mockApiService.scanBarcode
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    service.processHardwareScan('111111111111');
    service.processHardwareScan('222222222222');

    second.next({ success: true, message: '', record: { ...loggedRecord, discogsId: 2 } });
    first.next({ success: true, message: '', record: { ...loggedRecord, discogsId: 1 } });

    await vi.waitFor(() => expect(service.nowPlaying()?.discogsId).toBe(2));
    expect(service.scanLogged()).toBe(1);
  });

  it('should play beep sound without error when soundFeedback is enabled', () => {
    expect(() => service.playBeep()).not.toThrow();
  });

  it('should normalize German keyboard layout substitutions for custom QR codes', () => {
    expect(service.normalizeScannedCode('discogsßidÖ21024442')).toBe('discogs-id:21024442');
    expect(service.normalizeScannedCode('discogs-id:21024442')).toBe('discogs-id:21024442');
    expect(service.normalizeScannedCode('075678645624')).toBe('075678645624');
  });
});
