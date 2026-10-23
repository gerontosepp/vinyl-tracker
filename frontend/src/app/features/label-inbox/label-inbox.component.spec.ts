import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LabelInboxComponent } from './label-inbox.component';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { LabelPhoto } from '../../core/types';

const photo = (id: number): LabelPhoto => ({
  id,
  status: 'pending',
  discogsId: null,
  createdAt: `2026-10-22T15:0${id}:00Z`,
  processedAt: null,
});

describe('LabelInboxComponent', () => {
  let fixture: ComponentFixture<LabelInboxComponent>;
  let http: HttpTestingController;
  let toast: MockedObject<ToastService>;

  beforeAll(() => registerLocaleData(localeDe));

  beforeEach(async () => {
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;
    TestBed.configureTestingModule({
      imports: [LabelInboxComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    // The layout (navigation, menus) is not part of this test
    TestBed.overrideComponent(LabelInboxComponent, {
      remove: { imports: [LayoutComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LabelInboxComponent);
    // The app uses zone change detection: render on every change, the tests then await stability
    fixture.autoDetectChanges();
  });

  afterEach(() => http.verify());

  /** Answers the inbox request of the resource and renders the result. */
  async function loadInbox(photos: LabelPhoto[]): Promise<void> {
    TestBed.tick();
    const req = http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ photos, pendingCount: photos.length });
    await fixture.whenStable();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const all = (testId: string) => el().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
  const one = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it('shows the pending photos with their images and accessible delete buttons', async () => {
    await loadInbox([photo(1), photo(2)]);

    expect(all('label-inbox-photo').length).toBe(2);
    expect(one('label-inbox-count-text')?.textContent).toContain('2 offene Fotos');
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/label-photos/1/image');
    expect(img.alt).toContain('Label-Foto vom');
    expect(all('label-inbox-delete')[0].getAttribute('aria-label')).toMatch(/^Label-Foto vom .+ löschen$/);
  });

  it('shows an empty state', async () => {
    await loadInbox([]);
    expect(one('label-inbox-empty')?.textContent).toContain('Die Label-Inbox ist leer.');
    expect(one('label-inbox-delete-all')).toBeNull();
  });

  it('shows a load error with a retry', async () => {
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/label-photos').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(one('label-inbox-error')?.textContent).toContain('Die Label-Inbox konnte nicht geladen werden.');

    one('label-inbox-error')!.querySelector('button')!.click();
    await loadInbox([photo(1)]);
    expect(all('label-inbox-photo').length).toBe(1);
  });

  it('deletes a single photo', async () => {
    await loadInbox([photo(1), photo(2)]);

    all('label-inbox-delete')[0].click();
    http.expectOne({ url: '/api/label-photos/1', method: 'DELETE' }).flush(null);
    await fixture.whenStable();

    expect(all('label-inbox-photo').length).toBe(1);
    expect(one('label-inbox-count-text')?.textContent).toContain('1 offene Fotos');
    expect(toast.showToast).toHaveBeenCalledWith('Foto gelöscht.', 'success');
  });

  it('deletes all photos after confirmation', async () => {
    await loadInbox([photo(1), photo(2)]);

    one('label-inbox-delete-all')!.click();
    await fixture.whenStable();
    expect(one('label-inbox-confirm')?.getAttribute('role')).toBe('alert');
    expect(one('label-inbox-confirm')?.textContent).toContain('Wirklich alle 2 offenen Fotos löschen?');

    one('label-inbox-confirm-delete-all')!.click();
    const req = http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'DELETE');
    expect(req.request.params.get('status')).toBe('pending');
    req.flush({ deleted: 2, pendingCount: 0 });
    await fixture.whenStable();

    expect(one('label-inbox-empty')).not.toBeNull();
    expect(one('label-inbox-confirm')).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('2 Fotos gelöscht.', 'success');
  });

  it('keeps the photos and reports a failed delete', async () => {
    await loadInbox([photo(1), photo(2)]);

    all('label-inbox-delete')[0].click();
    http.expectOne({ url: '/api/label-photos/1', method: 'DELETE' }).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(all('label-inbox-photo').length).toBe(2);
    expect(toast.showToast).toHaveBeenLastCalledWith(expect.any(String), 'error');

    one('label-inbox-delete-all')!.click();
    await fixture.whenStable();
    one('label-inbox-confirm-delete-all')!.click();
    http
      .expectOne((r) => r.url === '/api/label-photos' && r.method === 'DELETE')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(all('label-inbox-photo').length).toBe(2);
    expect(one('label-inbox-confirm')).toBeNull();
  });
});
