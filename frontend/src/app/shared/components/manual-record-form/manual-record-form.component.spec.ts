import type { MockedObject } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ManualRecordFormComponent, ManualRecordPrefill } from './manual-record-form.component';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { IMAGE_DOWNSCALER } from '../../../core/utils/image';
import { RecordDetailDto } from '../../../core/types';
import { provideRouter } from '@angular/router';

const detail = (extra: Partial<RecordDetailDto> = {}): RecordDetailDto => ({
  id: 11,
  discogs_id: -3,
  title: 'Posen',
  artist: 'Die Sterne',
  year: '1996',
  genres: ['Rock', 'Pop'],
  in_collection: true,
  listen_count: 0,
  tracklist: [],
  formats: [],
  labels: [{ name: "L'age D'or", catno: 'LADO 17053' }],
  format: 'LP',
  country: 'Germany',
  barcode: '4006381333931',
  median_price: 25.5,
  media_condition: 'Very Good Plus (VG+)',
  source: 'manual',
  ...extra,
});

@Component({
  standalone: true,
  imports: [ManualRecordFormComponent],
  template: `
    <app-manual-record-form
      [record]="record()"
      [prefill]="prefill()"
      (saved)="saved.push($event)"
      (closed)="closed = closed + 1"
    />
  `,
})
class HostComponent {
  readonly record = signal<RecordDetailDto | null>(null);
  readonly prefill = signal<ManualRecordPrefill | null>(null);
  saved: RecordDetailDto[] = [];
  closed = 0;
}

describe('ManualRecordFormComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let http: HttpTestingController;
  let toast: MockedObject<ToastService>;
  const downscale = vi.fn(async (file: Blob) => new Blob([file], { type: 'image/jpeg' }));

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:cover');
    URL.revokeObjectURL = vi.fn();
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: IMAGE_DOWNSCALER, useValue: downscale },
      ],
    });
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement;
  const field = <T extends HTMLElement = HTMLInputElement>(testId: string) =>
    el().querySelector<T>(`[data-testid="${testId}"]`)!;

  async function type(testId: string, value: string): Promise<void> {
    const input = field<HTMLInputElement | HTMLSelectElement>(testId);
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    field<HTMLButtonElement>('manual-record-save').click();
    await fixture.whenStable();
  }

  it('starts from the prefill and requires artist, title and a valid year', async () => {
    fixture.componentInstance.prefill.set({ artist: 'Embryo', catno: '30561', year: '96', format: 'cd' });
    await fixture.whenStable();

    expect(el().querySelector('h3')?.textContent).toContain('Platte manuell anlegen');
    expect(el().querySelector('[data-testid="help-link"]')?.getAttribute('href')).toBe('/help#manuell');
    expect(field('manual-artist').value).toBe('Embryo');
    expect(field('manual-catno').value).toBe('30561');
    expect(field<HTMLSelectElement>('manual-format').value).toBe('CD');
    // An unreadable year from the label is not taken over
    expect(field('manual-year').value).toBe('');

    const save = field<HTMLButtonElement>('manual-record-save');
    expect(save.disabled).toBe(true);
    await type('manual-title', "Embryo's Rache");
    expect(save.disabled).toBe(false);

    await type('manual-year', '96');
    expect(save.disabled).toBe(true);
    expect(el().textContent).toContain('Bitte vier Ziffern');
  });

  it('creates the record with label photo, uploads an own cover and shows the shelf slot', async () => {
    fixture.componentInstance.prefill.set({ artist: 'Embryo', labelPhotoId: 7 });
    await fixture.whenStable();
    expect(field('manual-label-photo-hint')).not.toBeNull();

    await type('manual-title', "Embryo's Rache");
    await type('manual-year', '1996');
    await type('manual-barcode', '4006381333931');
    await type('manual-value', '19.90');
    await type('manual-media-condition', 'Near Mint (NM or M-)');

    const cover = field('manual-cover-input');
    Object.defineProperty(cover, 'files', { value: [new File(['x'], 'cover.png', { type: 'image/png' })] });
    cover.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(field('manual-cover-preview')).not.toBeNull());
    expect(downscale).toHaveBeenCalled();

    await submit();
    const create = http.expectOne({ method: 'POST', url: '/api/records/manual' });
    expect(create.request.body).toEqual({
      artist: 'Embryo',
      title: "Embryo's Rache",
      format: 'LP',
      year: '1996',
      label: null,
      catno: null,
      country: null,
      barcode: '4006381333931',
      genres: [],
      mediaCondition: 'Near Mint (NM or M-)',
      sleeveCondition: null,
      notes: null,
      value: 19.9,
      labelPhotoId: 7,
    });
    create.flush({
      record: detail({ title: "Embryo's Rache" }),
      placement: {
        discogsId: -3,
        slot: { unitId: 1, unitName: 'Kallax', compartment: 2, row: 1, column: 2, oversized: false, unplaced: false },
        neighbors: {},
        moves: [],
      },
    });
    await fixture.whenStable();

    const upload = http.expectOne({ method: 'PUT', url: '/api/records/-3/cover' });
    expect(upload.request.headers.get('Content-Type')).toBe('image/jpeg');
    upload.flush(detail({ title: "Embryo's Rache", thumb_url: '/api/covers/uid?v=1' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.saved[0].thumb_url).toBe('/api/covers/uid?v=1');
    expect(field('manual-record-saved').textContent).toContain('„Embryo\'s Rache“ wurde angelegt');
    expect(el().querySelector('[data-testid="storage-placement"]')).not.toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('„Embryo\'s Rache“ wurde angelegt', 'success');

    field<HTMLButtonElement>('manual-record-done').click();
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('edits an existing manual record', async () => {
    fixture.componentInstance.record.set(detail());
    await fixture.whenStable();

    expect(el().querySelector('h3')?.textContent).toContain('Manuelle Platte bearbeiten');
    expect(field('manual-label').value).toBe("L'age D'or");
    expect(field('manual-value').value).toBe('25.5');
    await type('manual-title', 'Posen (Remaster)');
    await submit();

    const update = http.expectOne({ method: 'PUT', url: '/api/records/-3/manual' });
    expect(update.request.body).toMatchObject({
      title: 'Posen (Remaster)',
      genres: ['Rock', 'Pop'],
      catno: 'LADO 17053',
      mediaCondition: 'Very Good Plus (VG+)',
      labelPhotoId: null,
    });
    update.flush(detail({ title: 'Posen (Remaster)' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.saved[0].title).toBe('Posen (Remaster)');
    expect(fixture.componentInstance.closed).toBe(1);
    expect(toast.showToast).toHaveBeenCalledWith('Änderungen gespeichert', 'success');
  });

  it('reports a failed save and stays open', async () => {
    fixture.componentInstance.prefill.set({ artist: 'A', title: 'B' });
    await fixture.whenStable();
    await submit();
    http
      .expectOne('/api/records/manual')
      .flush({ detail: 'Invalid format' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(toast.showToast).toHaveBeenCalledWith('Invalid format', 'error');
    expect(field('manual-record-save').disabled).toBe(false);
    expect(fixture.componentInstance.closed).toBe(0);
  });

  it('keeps a created record when only the cover upload fails', async () => {
    fixture.componentInstance.prefill.set({ artist: 'A', title: 'B' });
    await fixture.whenStable();
    const cover = field('manual-cover-input');
    Object.defineProperty(cover, 'files', { value: [new File(['x'], 'cover.jpg', { type: 'image/jpeg' })] });
    cover.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(field('manual-cover-preview')).not.toBeNull());

    await submit();
    http.expectOne('/api/records/manual').flush({ record: detail() });
    await fixture.whenStable();
    http.expectOne('/api/records/-3/cover').flush(null, { status: 413, statusText: 'Payload Too Large' });
    await fixture.whenStable();

    expect(toast.showToast).toHaveBeenCalledWith(
      'Die Platte ist gespeichert, das Cover aber nicht. Du kannst es später beim Bearbeiten hinzufügen.',
      'error'
    );
    // Saved once, no second save possible
    expect(fixture.componentInstance.saved.length).toBe(1);
    expect(field('manual-record-saved')).not.toBeNull();
    expect(el().querySelector('[data-testid="manual-record-save"]')).toBeNull();
  });

  it('reports a cover that cannot be read', async () => {
    downscale.mockRejectedValueOnce(new Error('HEIC'));
    const cover = field('manual-cover-input');
    Object.defineProperty(cover, 'files', { value: [new File(['x'], 'cover.heic')] });
    cover.dispatchEvent(new Event('change'));
    await vi.waitFor(() =>
      expect(toast.showToast).toHaveBeenCalledWith('Das Foto konnte nicht gelesen werden.', 'error')
    );
  });

  it('closes on Escape', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closed).toBe(1);
  });
});
