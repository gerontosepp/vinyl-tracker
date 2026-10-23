import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { LabelPhotoCaptureComponent } from './label-photo-capture.component';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { IMAGE_DOWNSCALER } from '../../../core/utils/image';
import { Router } from '@angular/router';
import { ScannerService } from '../../../core/services/scanner.service';

describe('LabelPhotoCaptureComponent', () => {
  let fixture: ComponentFixture<LabelPhotoCaptureComponent>;
  let component: LabelPhotoCaptureComponent;
  let apiServiceMock: MockedObject<ApiService>;
  let toastServiceMock: MockedObject<ToastService>;
  const downscaled = new Blob(['jpeg'], { type: 'image/jpeg' });
  let downscale: ReturnType<typeof vi.fn>;

  /** `null` simulates an inbox request that failed. */
  async function setup(pendingCount: number | null = 2): Promise<void> {
    const inbox = signal(pendingCount === null ? undefined : { photos: [], pendingCount });
    apiServiceMock = {
      labelPhotosResource: vi.fn().mockReturnValue({ hasValue: () => inbox() !== undefined, value: inbox }),
      uploadLabelPhoto: vi.fn(),
    } as unknown as MockedObject<ApiService>;
    toastServiceMock = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;

    await TestBed.configureTestingModule({
      imports: [LabelPhotoCaptureComponent],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: IMAGE_DOWNSCALER, useValue: downscale },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');

    fixture = TestBed.createComponent(LabelPhotoCaptureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function selectFile(file: File | null): { event: Event; input: HTMLInputElement } {
    const input = fixture.nativeElement.querySelector('[data-testid="label-photo-input"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
    return { event: { target: input } as unknown as Event, input };
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    downscale = vi.fn().mockResolvedValue(downscaled);
  });

  it('opens the label inbox from the badge and closes the scanner', async () => {
    await setup(2);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const scanner = TestBed.inject(ScannerService);
    scanner.openScanner();

    fixture.nativeElement.querySelector('[data-testid="label-inbox-count"]').click();

    expect(scanner.showScanner()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/label-inbox']);
  });

  it('shows the button and the number of open photos', async () => {
    await setup(2);
    expect(apiServiceMock.labelPhotosResource).toHaveBeenCalledWith('pending', 1);
    expect(text()).toContain('Label fotografieren');
    const badge = fixture.nativeElement.querySelector('[data-testid="label-inbox-count"]');
    expect(badge.textContent).toContain('2 in der Inbox');
    expect(badge.getAttribute('aria-label')).toBe('Label-Inbox öffnen (2 offen)');
  });

  it('hides the badge when the inbox is empty or cannot be loaded', async () => {
    await setup(0);
    expect(fixture.nativeElement.querySelector('[data-testid="label-inbox-count"]')).toBeNull();
  });

  it('hides the badge when the inbox cannot be loaded', async () => {
    await setup(null);
    expect(component.pendingCount()).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="label-inbox-count"]')).toBeNull();
  });

  it('downscales and uploads the photo, then updates the count', async () => {
    await setup(2);
    apiServiceMock.uploadLabelPhoto.mockReturnValue(of({ id: 9, pendingCount: 3 }));
    const photo = new File(['raw'], 'label.heic', { type: 'image/heic' });
    const { event, input } = selectFile(photo);

    await component.onFileSelected(event);
    fixture.detectChanges();

    expect(downscale).toHaveBeenCalledWith(photo);
    expect(apiServiceMock.uploadLabelPhoto).toHaveBeenCalledWith(downscaled);
    expect(component.pendingCount()).toBe(3);
    expect(component.isUploading()).toBe(false);
    expect(input.value).toBe('');
    expect(toastServiceMock.showToast).toHaveBeenCalledWith(
      'Foto in der Label-Inbox gespeichert (3 offen).',
      'success'
    );
  });

  it('reports upload errors as toast and keeps the count', async () => {
    await setup(2);
    apiServiceMock.uploadLabelPhoto.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'Invalid image: unsupported format' },
          })
      )
    );
    const { event } = selectFile(new File(['x'], 'x.jpg'));

    await component.onFileSelected(event);

    expect(component.pendingCount()).toBe(2);
    expect(component.isUploading()).toBe(false);
    expect(toastServiceMock.showToast).toHaveBeenCalledWith('Invalid image: unsupported format', 'error');
  });

  it('uses the fallback message when the photo cannot be processed', async () => {
    await setup(2);
    downscale.mockRejectedValue('decode failed');
    const { event } = selectFile(new File(['x'], 'x.jpg'));

    await component.onFileSelected(event);

    expect(apiServiceMock.uploadLabelPhoto).not.toHaveBeenCalled();
    expect(toastServiceMock.showToast).toHaveBeenCalledWith(
      'Das Foto konnte nicht gespeichert werden.',
      'error'
    );
  });

  it('ignores an empty file selection', async () => {
    await setup(2);
    const { event } = selectFile(null);

    await component.onFileSelected(event);

    expect(downscale).not.toHaveBeenCalled();
    expect(toastServiceMock.showToast).not.toHaveBeenCalled();
  });
});
