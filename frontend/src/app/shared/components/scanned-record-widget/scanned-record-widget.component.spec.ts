import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ScannedRecordWidgetComponent } from './scanned-record-widget.component';
import { ScannerService } from '../../../core/services/scanner.service';
import { ApiService } from '../../../core/services/api.service';

const record = { discogsId: 42, title: 'Kind of Blue', artist: 'Miles Davis', thumbUrl: '/cover.jpg' };

describe('ScannedRecordWidgetComponent', () => {
  let fixture: ComponentFixture<ScannedRecordWidgetComponent>;
  let scanner: ScannerService;
  let mockRouter: any;

  const q = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  const show = (): void => {
    scanner.nowPlaying.set(record);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.clear();
    mockRouter = {
      events: {
        pipe: () => ({
          subscribe: () => ({ unsubscribe: () => { } }),
        }),
      },
      navigate: vi.fn().mockName('navigate').mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [ScannedRecordWidgetComponent],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ApiService, useValue: { getProxiedImageUrl: (url: string) => url } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScannedRecordWidgetComponent);
    scanner = TestBed.inject(ScannerService);
    scanner.setResultDisplaySeconds(5);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('shows the scanned record', () => {
    show();

    expect(q('scan-widget')).not.toBeNull();
    expect(q('scan-widget')!.textContent).toContain('Kind of Blue');
    expect(q('scan-widget')!.textContent).toContain('Miles Davis');
  });

  it('stays hidden while the scanner screen is open', () => {
    scanner.openScanner();
    show();

    expect(q('scan-widget')).toBeNull();
  });

  it('hides after the configured time', () => {
    vi.useFakeTimers();
    show();

    vi.advanceTimersByTime(4900);
    fixture.detectChanges();
    expect(q('scan-widget')).not.toBeNull();

    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(q('scan-widget')).toBeNull();
  });

  it('pauses while the user interacts and resumes afterwards', () => {
    vi.useFakeTimers();
    show();
    const widget = q('scan-widget')!;

    widget.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(q('scan-widget')).not.toBeNull();

    widget.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(q('scan-widget')).toBeNull();
  });

  it('pauses while the close button has focus', () => {
    vi.useFakeTimers();
    show();

    q('scan-widget-close')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(q('scan-widget')).not.toBeNull();

    q('scan-widget-close')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(q('scan-widget')).toBeNull();
  });

  it('closes immediately', () => {
    show();

    q('scan-widget-close')!.click();
    fixture.detectChanges();

    expect(q('scan-widget')).toBeNull();
    expect(scanner.nowPlaying()).toBeNull();
  });

  it('opens the record detail on click', () => {
    show();

    q('scan-widget-open')!.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/collection']);
    expect(scanner.pendingRecordDetail()).toEqual(record);
    expect(scanner.nowPlaying()).toBeNull();
  });

  it('shows the remaining time in the progress bar', () => {
    vi.useFakeTimers();
    show();

    vi.advanceTimersByTime(2500);
    fixture.detectChanges();
    const progress = q('scan-widget-progress') as HTMLElement;
    const width = parseFloat(progress.style.width);

    expect(width).toBeGreaterThan(40);
    expect(width).toBeLessThan(60);
  });
});
