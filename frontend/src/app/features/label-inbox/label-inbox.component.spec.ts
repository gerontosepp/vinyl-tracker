import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { IDENTIFY_POLL_MS, LabelInboxComponent } from './label-inbox.component';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { LabelCandidate, LabelPhoto } from '../../core/types';
import { provideRouter } from '@angular/router';

const photo = (id: number): LabelPhoto => ({
  id,
  status: 'pending',
  discogsId: null,
  createdAt: `2026-10-22T15:0${id}:00Z`,
  processedAt: null,
});

const candidate = (discogsId: number, extra: Partial<LabelCandidate> = {}): LabelCandidate => ({
  discogsId,
  confidence: 'high',
  reason: 'Katalognummer passt',
  artist: 'Embryo (3)',
  title: "Embryo's Rache",
  label: 'Schneeball',
  catno: '30561',
  country: 'Germany',
  year: '1996',
  inCollection: false,
  ...extra,
});

const suggested = (id: number): LabelPhoto => ({
  ...photo(id),
  identifyState: 'done',
  identifyModel: 'anthropic/claude-sonnet-5.5',
  suggestion: {
    best: candidate(1622788, { inCollection: true }),
    alternatives: [candidate(18105178, { confidence: 'medium', label: 'Materiali Sonori', catno: 'LON006LP' })],
    hint: 'Auslaufrille prüfen',
  },
});

describe('LabelInboxComponent', () => {
  let fixture: ComponentFixture<LabelInboxComponent> | undefined;
  let http: HttpTestingController;
  let toast: MockedObject<ToastService>;

  beforeAll(() => registerLocaleData(localeDe));

  // jsdom has no object URLs; the cards show the loaded photo blob through them
  let objectUrls: number;
  beforeEach(() => {
    objectUrls = 0;
    URL.createObjectURL = vi.fn(() => `blob:photo-${++objectUrls}`);
    URL.revokeObjectURL = vi.fn();
  });

  beforeEach(async () => {
    toast = { showToast: vi.fn() } as unknown as MockedObject<ToastService>;
    TestBed.configureTestingModule({
      imports: [LabelInboxComponent],
      providers: [
        provideRouter([]),provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    // The layout (navigation, menus) is not part of this test
    TestBed.overrideComponent(LabelInboxComponent, {
      remove: { imports: [LayoutComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = undefined;
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  function create(): void {
    fixture = TestBed.createComponent(LabelInboxComponent);
    // The app uses zone change detection: render on every change, the tests then await stability
    fixture.autoDetectChanges();
  }

  /** Answers the OpenRouter settings request (once per component). */
  function answerSettings(hasApiKey: boolean): void {
    http
      .match((r) => r.url === '/api/users/me/openrouter')
      .forEach((req) => req.flush({ hasApiKey, model: 'm', defaultModel: 'm' }));
  }

  /** Answers the inbox request of the resource and renders the result. */
  async function loadInbox(photos: LabelPhoto[], hasApiKey = false): Promise<void> {
    if (!fixture) create();
    TestBed.tick();
    answerSettings(hasApiKey);
    const req = http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET');
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ photos, pendingCount: photos.length });
    await answerImages();
  }

  /** Waits until the rendered cards requested their photos and answers them. */
  async function answerImages(): Promise<void> {
    await nextImageRequests((req) => req.flush(new Blob(['jpeg'], { type: 'image/jpeg' })));
    await fixture!.whenStable();
  }

  /**
   * The cards render after the inbox resource resolved and only then request their photos; the
   * pending photo requests keep the app unstable, so `whenStable` cannot be used to wait for them.
   */
  async function nextImageRequests(answer: (req: TestRequest) => void): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      const requests = http.match((r) => r.url.endsWith('/image'));
      requests.forEach(answer);
      if (requests.length) return;
    }
  }

  const el = (): HTMLElement => fixture!.nativeElement;
  const all = (testId: string) => el().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
  const one = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it('shows the pending photos with their images and accessible delete buttons', async () => {
    await loadInbox([photo(1), photo(2)]);

    expect(all('label-inbox-photo').length).toBe(2);
    expect(one('label-inbox-count-text')?.textContent).toContain('2 offene Fotos');
    // Loaded with the Bearer token via HttpClient, shown as object URL
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:photo-1');
    expect(img.alt).toContain('Label-Foto vom');
    expect(all('label-inbox-delete')[0].getAttribute('aria-label')).toMatch(/^Label-Foto vom .+ löschen$/);
  });

  it('shows a hint instead of a black area when the photo cannot be loaded', async () => {
    create();
    TestBed.tick();
    answerSettings(false);
    http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET').flush({ photos: [photo(1)], pendingCount: 1 });
    await nextImageRequests((image) => {
      expect(image.request.responseType).toBe('blob');
      image.flush(new Blob([]), { status: 401, statusText: 'Unauthorized' });
    });
    await fixture!.whenStable();

    expect(el().querySelector('img')).toBeNull();
    expect(one('label-photo-image-placeholder')?.textContent).toContain('Foto konnte nicht geladen werden.');

    one('label-photo-image-retry')!.click();
    await answerImages();
    expect(el().querySelector('img')?.getAttribute('src')).toBe('blob:photo-1');
  });

  it('enlarges the photo in the app and closes it with Escape', async () => {
    await loadInbox([photo(1)]);
    one('label-photo-thumbnail')!.click();
    await fixture!.whenStable();
    expect(one('label-photo-fullsize')?.querySelector('img')?.getAttribute('src')).toBe('blob:photo-1');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture!.whenStable();
    expect(one('label-photo-fullsize')).toBeNull();
  });

  it('loads a photo only once its card scrolls into view', async () => {
    let reveal: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
        }
        observe = observe;
        disconnect = disconnect;
      }
    );
    try {
      create();
      TestBed.tick();
      answerSettings(false);
      http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET').flush({ photos: [photo(1)], pendingCount: 1 });
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      expect(observe).toHaveBeenCalled();
      expect(http.match((r) => r.url.endsWith('/image')).length).toBe(0);

      reveal!();
      await answerImages();
      expect(el().querySelector('img')?.getAttribute('src')).toBe('blob:photo-1');
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows an empty state', async () => {
    await loadInbox([]);
    expect(one('label-inbox-empty')?.textContent).toContain('Die Label-Inbox ist leer.');
    expect(one('label-inbox-delete-all')).toBeNull();
  });

  it('shows a load error with a retry', async () => {
    create();
    TestBed.tick();
    answerSettings(false);
    http.expectOne((r) => r.url === '/api/label-photos').flush(null, { status: 500, statusText: 'Error' });
    await fixture!.whenStable();
    expect(one('label-inbox-error')?.textContent).toContain('Die Label-Inbox konnte nicht geladen werden.');

    one('label-inbox-error')!.querySelector('button')!.click();
    await loadInbox([photo(1)]);
    expect(all('label-inbox-photo').length).toBe(1);
  });

  it('deletes a single photo', async () => {
    await loadInbox([photo(1), photo(2)]);

    all('label-inbox-delete')[0].click();
    http.expectOne({ url: '/api/label-photos/1', method: 'DELETE' }).flush(null);
    await fixture!.whenStable();

    expect(all('label-inbox-photo').length).toBe(1);
    expect(one('label-inbox-count-text')?.textContent).toContain('1 offene Fotos');
    expect(toast.showToast).toHaveBeenCalledWith('Foto gelöscht.', 'success');
  });

  it('deletes all photos after confirmation', async () => {
    await loadInbox([photo(1), photo(2)]);

    one('label-inbox-delete-all')!.click();
    await fixture!.whenStable();
    expect(one('label-inbox-confirm')?.getAttribute('role')).toBe('alert');
    expect(one('label-inbox-confirm')?.textContent).toContain('Wirklich alle 2 offenen Fotos löschen?');

    one('label-inbox-confirm-delete-all')!.click();
    const req = http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'DELETE');
    expect(req.request.params.get('status')).toBe('pending');
    req.flush({ deleted: 2, pendingCount: 0 });
    await fixture!.whenStable();

    expect(one('label-inbox-empty')).not.toBeNull();
    expect(one('label-inbox-confirm')).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('2 Fotos gelöscht.', 'success');
  });

  it('keeps the photos and reports a failed delete', async () => {
    await loadInbox([photo(1), photo(2)]);

    all('label-inbox-delete')[0].click();
    http.expectOne({ url: '/api/label-photos/1', method: 'DELETE' }).flush(null, { status: 500, statusText: 'Error' });
    await fixture!.whenStable();
    expect(all('label-inbox-photo').length).toBe(2);
    expect(toast.showToast).toHaveBeenLastCalledWith(expect.any(String), 'error');

    one('label-inbox-delete-all')!.click();
    await fixture!.whenStable();
    one('label-inbox-confirm-delete-all')!.click();
    http
      .expectOne((r) => r.url === '/api/label-photos' && r.method === 'DELETE')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture!.whenStable();
    expect(all('label-inbox-photo').length).toBe(2);
    expect(one('label-inbox-confirm')).toBeNull();
  });

  describe('automatic identification', () => {
    it('shows running identifications and refreshes until they are done', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      await loadInbox([{ ...photo(1), identifyState: 'running' }], true);
      expect(one('label-photo-identifying')?.textContent).toContain('Wird erkannt…');

      vi.advanceTimersByTime(IDENTIFY_POLL_MS);
      TestBed.tick();
      http.expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET').flush({ photos: [suggested(1)], pendingCount: 1 });
      await fixture!.whenStable();
      expect(one('label-photo-suggestion')).not.toBeNull();

      vi.advanceTimersByTime(IDENTIFY_POLL_MS);
      TestBed.tick();
      expect(http.match((r) => r.url === '/api/label-photos').length).toBe(0);
    });

    it('shows the suggestion with alternatives, confidence and hint', async () => {
      await loadInbox([suggested(1)], true);
      const card = one('label-photo-suggestion')!;
      expect(card.textContent).toContain("Embryo (3) – Embryo's Rache");
      expect(card.textContent).toContain('Schneeball · 30561 · Germany · 1996 · Discogs 1622788');
      expect(card.textContent).toContain('Sicher');
      expect(card.textContent).toContain('Schon in der Sammlung');
      expect(card.textContent).toContain('Andere Pressungen');
      expect(card.textContent).toContain('Auslaufrille prüfen');
      expect(one('label-photo-add')?.textContent).toContain('Weiteres Exemplar hinzufügen');
    });

    it('adds the chosen release, completes the photo and shows the shelf slot', async () => {
      await loadInbox([suggested(1)], true);

      one('label-photo-add')!.click();
      http.expectOne({ url: '/api/collection/releases/1622788', method: 'POST' }).flush({
        added: 1,
        removed: 0,
        placement: {
          discogsId: 1622788,
          slot: { unitId: 1, unitName: 'Kallax_1', compartment: 4, row: 2, column: 1, oversized: false, unplaced: false },
          neighbors: { previous: null, next: null },
          moves: [],
        },
      });
      await fixture!.whenStable();
      const patch = http.expectOne({ url: '/api/label-photos/1', method: 'PATCH' });
      expect(patch.request.body).toEqual({ status: 'identified', discogsId: 1622788 });
      patch.flush({ ...suggested(1), status: 'identified' });
      await fixture!.whenStable();

      // The second request finishes the action, the next render shows the result
      await fixture!.whenStable();
      expect(all('label-inbox-photo').length).toBe(0);
      expect(one('label-inbox-placement')?.textContent).toContain("Embryo (3) – Embryo's Rache");
      expect(toast.showToast).toHaveBeenCalledWith("„Embryo (3) – Embryo's Rache“ hinzugefügt.", 'success');
    });

    it('does not add a second copy when completing the photo failed', async () => {
      await loadInbox([suggested(1)], true);

      one('label-photo-add')!.click();
      http.expectOne({ url: '/api/collection/releases/1622788', method: 'POST' }).flush({ added: 1, removed: 0 });
      // The PATCH follows once the add response was processed
      await new Promise((resolve) => setTimeout(resolve));
      await fixture!.whenStable();
      http.expectOne({ url: '/api/label-photos/1', method: 'PATCH' }).flush(null, { status: 500, statusText: 'Error' });
      await fixture!.whenStable();
      await fixture!.whenStable();
      expect(all('label-inbox-photo').length).toBe(1);
      expect(toast.showToast).toHaveBeenLastCalledWith(expect.any(String), 'error');
      // The button is enabled again once the failed action has been rendered
      await new Promise((resolve) => setTimeout(resolve));
      await fixture!.whenStable();
      expect((one('label-photo-add') as HTMLButtonElement).disabled).toBe(false);

      one('label-photo-add')!.click();
      http.expectNone({ url: '/api/collection/releases/1622788', method: 'POST' });
      http.expectOne({ url: '/api/label-photos/1', method: 'PATCH' }).flush({ ...suggested(1), status: 'identified' });
      await fixture!.whenStable();
      await fixture!.whenStable();
      expect(all('label-inbox-photo').length).toBe(0);
    });

    it('keeps a chosen alternative when the inbox refreshes', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      await loadInbox([suggested(1), { ...photo(2), identifyState: 'running' }], true);
      el().querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
      await fixture!.whenStable();

      vi.advanceTimersByTime(IDENTIFY_POLL_MS);
      TestBed.tick();
      http
        .expectOne((r) => r.url === '/api/label-photos' && r.method === 'GET')
        .flush({ photos: [suggested(1), { ...photo(2), identifyState: 'running' }], pendingCount: 2 });
      await fixture!.whenStable();

      expect(el().querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].checked).toBe(true);
      one('label-photo-complete')!.click();
      const patch = http.expectOne({ url: '/api/label-photos/1', method: 'PATCH' });
      expect(patch.request.body).toEqual({ status: 'identified', discogsId: 18105178 });
      patch.flush({ ...suggested(1), status: 'identified' });
      await fixture!.whenStable();
      await fixture!.whenStable();
    });

    it('completes the photo with a chosen alternative without adding', async () => {
      await loadInbox([suggested(1)], true);

      const radios = el().querySelectorAll<HTMLInputElement>('input[type="radio"]');
      radios[1].click();
      await fixture!.whenStable();
      one('label-photo-complete')!.click();
      const patch = http.expectOne({ url: '/api/label-photos/1', method: 'PATCH' });
      expect(patch.request.body).toEqual({ status: 'identified', discogsId: 18105178 });
      patch.flush({ ...suggested(1), status: 'identified' });
      await fixture!.whenStable();

      expect(all('label-inbox-photo').length).toBe(0);
      expect(toast.showToast).toHaveBeenCalledWith('Foto abgeschlossen.', 'success');
    });

    it('retries a failed identification', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      await loadInbox([{ ...photo(1), identifyState: 'error', identifyError: 'OpenRouter rejected the API key' }], true);
      expect(one('label-photo-error')?.textContent).toContain('Nicht erkannt: OpenRouter rejected the API key');

      one('label-photo-identify')!.click();
      http.expectOne({ url: '/api/label-photos/1/identify', method: 'POST' }).flush({ ...photo(1), identifyState: 'queued' });
      await fixture!.whenStable();
      expect(one('label-photo-identifying')).not.toBeNull();
    });

    it('offers no identification without an OpenRouter key', async () => {
      await loadInbox([{ ...photo(1), identifyState: 'error', identifyError: 'x' }], false);
      expect(one('label-photo-identify')).toBeNull();
    });
  });
});
