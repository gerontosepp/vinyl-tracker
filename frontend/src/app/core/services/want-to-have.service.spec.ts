import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WantToHaveService } from './want-to-have.service';
import { ToastService } from './toast.service';
import { LanguageService } from './language.service';
import { AuthService } from './auth.service';
import { WantToHaveItem } from '../types';

const item = (id: number, discogsId: number): WantToHaveItem => ({
  id,
  discogs_id: discogsId,
  title: 'Kind of Blue',
  artist: 'Miles Davis',
  genres: ['Jazz'],
  created_at: '2026-11-04T10:00:00+00:00',
});

describe('WantToHaveService', () => {
  let service: WantToHaveService;
  let http: HttpTestingController;
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { showToast: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        // The real service would check the session through HTTP on construction
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
    TestBed.inject(LanguageService).setLanguage('de');
    service = TestBed.inject(WantToHaveService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function load(items: WantToHaveItem[]): Promise<void> {
    const loading = service.load();
    http.expectOne({ url: '/api/want-to-have', method: 'GET' }).flush(items);
    await loading;
  }

  it('loads the list and knows which releases are on it', async () => {
    await load([item(1, 100), item(2, 200)]);

    expect(service.loaded()).toBe(true);
    expect(service.has(100)).toBe(true);
    expect(service.has(300)).toBe(false);
  });

  it('loads the list only once with ensureLoaded', async () => {
    const first = service.ensureLoaded();
    http.expectOne('/api/want-to-have').flush([]);
    await first;

    await service.ensureLoaded();
    http.expectNone('/api/want-to-have');
  });

  it('reports a failed load and allows a retry', async () => {
    const loading = service.load();
    http.expectOne('/api/want-to-have').flush(null, { status: 500, statusText: 'Error' });
    await loading;

    expect(service.loadFailed()).toBe(true);
    expect(service.loaded()).toBe(false);
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');

    await load([item(1, 100)]);
    expect(service.loadFailed()).toBe(false);
    expect(service.items().length).toBe(1);
  });

  it('adds a release at the top of the list and confirms with a toast', async () => {
    await load([item(1, 100)]);

    const adding = service.add(200, 'Kind of Blue');
    const req = http.expectOne({ url: '/api/want-to-have', method: 'POST' });
    expect(req.request.body).toEqual({ discogs_id: 200 });
    req.flush(item(2, 200));

    expect(await adding).toBe(true);
    expect(service.items().map((i) => i.discogs_id)).toEqual([200, 100]);
    expect(toast.showToast).toHaveBeenCalledWith('„Kind of Blue“ zu Want-to-Have hinzugefügt.', 'success');
  });

  it('keeps the list and shows the server message when adding fails', async () => {
    await load([]);

    const adding = service.add(200, 'Kind of Blue');
    http.expectOne({ url: '/api/want-to-have', method: 'POST' }).flush(
      { detail: 'Record is already in your collection' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(await adding).toBe(false);
    expect(service.items()).toEqual([]);
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('removes an entry', async () => {
    await load([item(1, 100), item(2, 200)]);

    const removing = service.remove(item(1, 100));
    http.expectOne({ url: '/api/want-to-have/1', method: 'DELETE' }).flush(null);

    expect(await removing).toBe(true);
    expect(service.items().map((i) => i.id)).toEqual([2]);
    expect(toast.showToast).toHaveBeenCalledWith('Aus Want-to-Have entfernt.', 'success');
  });

  it('keeps the entry when removing fails', async () => {
    await load([item(1, 100)]);

    const removing = service.remove(item(1, 100));
    http.expectOne('/api/want-to-have/1').flush(null, { status: 500, statusText: 'Error' });

    expect(await removing).toBe(false);
    expect(service.items().length).toBe(1);
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('moves an entry to the collection', async () => {
    await load([item(1, 100)]);

    const moving = service.toCollection(item(1, 100));
    http.expectOne({ url: '/api/want-to-have/1/to-collection', method: 'POST' }).flush({ added: 1, removed: 0 });

    expect(await moving).toEqual({ added: 1, removed: 0 });
    expect(service.items()).toEqual([]);
    expect(toast.showToast).toHaveBeenCalledWith('„Kind of Blue“ ist jetzt in deiner Sammlung.', 'success');
  });

  it('keeps the entry when moving to the collection fails', async () => {
    await load([item(1, 100)]);

    const moving = service.toCollection(item(1, 100));
    http.expectOne('/api/want-to-have/1/to-collection').flush(null, { status: 502, statusText: 'Bad Gateway' });

    expect(await moving).toBeNull();
    expect(service.items().length).toBe(1);
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('WantToHaveService per user', () => {
  it('reloads the list when another user is logged in', async () => {
    const user = signal<{ id: number } | null>({ id: 1 });
    const toast = { showToast: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { user } },
      ],
    });
    const service = TestBed.inject(WantToHaveService);
    const http = TestBed.inject(HttpTestingController);

    const first = service.ensureLoaded();
    http.expectOne('/api/want-to-have').flush([item(1, 100)]);
    await first;
    expect(service.has(100)).toBe(true);

    // Same user: no second request
    await service.ensureLoaded();
    http.expectNone('/api/want-to-have');

    // Another user must not see the first user's entries
    user.set({ id: 2 });
    const second = service.ensureLoaded();
    expect(service.has(100)).toBe(false);
    http.expectOne('/api/want-to-have').flush([item(9, 900)]);
    await second;
    expect(service.has(900)).toBe(true);
    http.verify();
  });
});
