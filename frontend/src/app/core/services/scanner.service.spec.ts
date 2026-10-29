import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ScannerService } from './scanner.service';
import { ToastService } from './toast.service';

describe('ScannerService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  let service: ScannerService;
  let mockRouter: any;

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

    TestBed.configureTestingModule({
      providers: [
        ScannerService,
        { provide: Router, useValue: mockRouter },
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
    expect(service.showScanner()).toBe(true);
    expect(service.scanTrigger()?.code).toBe(barcode);
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

  it('should navigate to home if on another page when scan is received', async () => {
    vi.useFakeTimers();
    mockRouter.url = '/collection';
    service.processHardwareScan('075678645624');
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    expect(service.showScanner()).toBe(true);
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
