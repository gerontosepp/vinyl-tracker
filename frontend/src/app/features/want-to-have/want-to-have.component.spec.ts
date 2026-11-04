import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { WantToHaveComponent } from './want-to-have.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { RecordDetailModalComponent } from '../collection/components/record-detail-modal/record-detail-modal.component';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { WantToHaveItem } from '../../core/types';

const item = (id: number, discogsId: number, title = 'Kind of Blue'): WantToHaveItem => ({
  id,
  discogs_id: discogsId,
  title,
  artist: 'Miles Davis',
  year: '1959',
  format: 'Vinyl, LP',
  genres: ['Jazz'],
  created_at: '2026-11-04T10:00:00+00:00',
});

describe('WantToHaveComponent', () => {
  let fixture: ComponentFixture<WantToHaveComponent>;
  let http: HttpTestingController;
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    toast = { showToast: vi.fn() };
    TestBed.configureTestingModule({
      imports: [WantToHaveComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
    TestBed.overrideComponent(WantToHaveComponent, {
      remove: { imports: [LayoutComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement;
  const all = (testId: string) => el().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);

  async function create(items: WantToHaveItem[] | 'error'): Promise<void> {
    fixture = TestBed.createComponent(WantToHaveComponent);
    fixture.autoDetectChanges();
    const req = http.expectOne({ url: '/api/want-to-have', method: 'GET' });
    if (items === 'error') req.flush(null, { status: 500, statusText: 'Error' });
    else req.flush(items);
    await fixture.whenStable();
  }

  function detailModal(): RecordDetailModalComponent {
    return fixture.debugElement.query((d) => d.componentInstance instanceof RecordDetailModalComponent)
      .componentInstance as RecordDetailModalComponent;
  }

  it('shows an empty state', async () => {
    await create([]);
    expect(all('want-to-have-empty').length).toBe(1);
    expect(all('want-to-have-item').length).toBe(0);
  });

  it('lists the saved records', async () => {
    await create([item(1, 100), item(2, 200, 'Blue Train')]);
    const rows = all('want-to-have-item');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Kind of Blue');
    expect(rows[0].textContent).toContain('1959 · Vinyl, LP');
  });

  it('shows a load error with a retry', async () => {
    await create('error');
    expect(all('want-to-have-error').length).toBe(1);

    el().querySelector<HTMLButtonElement>('[data-testid="want-to-have-error"] button')!.click();
    http.expectOne('/api/want-to-have').flush([item(1, 100)]);
    await fixture.whenStable();
    expect(all('want-to-have-item').length).toBe(1);
  });

  it('opens a record in want-to-have mode and loads its details', async () => {
    await create([item(1, 100)]);

    all('want-to-have-item')[0].click();
    const req = http.expectOne((r) => r.url === '/api/records/100');
    expect(detailModal().mode()).toBe('wantToHave');
    expect(detailModal().loading()).toBe(true);
    req.flush({
      discogs_id: 100,
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      genres: ['Jazz'],
      in_collection: false,
      listen_count: 0,
      listen_history: [],
      tracklist: [],
      formats: [],
      labels: [],
    });
    await fixture.whenStable();

    expect(detailModal().loading()).toBe(false);
    expect(detailModal().detail()?.discogs_id).toBe(100);
  });

  it('keeps the header when the details cannot be loaded', async () => {
    await create([item(1, 100)]);

    all('want-to-have-item')[0].click();
    http.expectOne((r) => r.url === '/api/records/100').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(detailModal().loading()).toBe(false);
    expect(detailModal().detail()).toBeNull();
    expect(detailModal().record()?.basic_information.title).toBe('Kind of Blue');
  });

  it('adds the record to the collection and closes the details', async () => {
    await create([item(1, 100), item(2, 200)]);
    all('want-to-have-item')[0].click();
    http.expectOne((r) => r.url === '/api/records/100').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    detailModal().addToCollection.emit();
    http.expectOne({ url: '/api/want-to-have/1/to-collection', method: 'POST' }).flush({ added: 1, removed: 0 });
    await fixture.whenStable();

    expect(all('want-to-have-item').length).toBe(1);
    expect(detailModal().record()).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('„Kind of Blue“ ist jetzt in deiner Sammlung.', 'success');
  });

  it('removes the record and closes the details', async () => {
    await create([item(1, 100)]);
    all('want-to-have-item')[0].click();
    http.expectOne((r) => r.url === '/api/records/100').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    detailModal().removeWanted.emit();
    http.expectOne({ url: '/api/want-to-have/1', method: 'DELETE' }).flush(null);
    await fixture.whenStable();

    expect(all('want-to-have-empty').length).toBe(1);
    expect(detailModal().record()).toBeNull();
  });

  it('keeps the details open when removing fails', async () => {
    await create([item(1, 100)]);
    all('want-to-have-item')[0].click();
    http.expectOne((r) => r.url === '/api/records/100').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    detailModal().removeWanted.emit();
    http.expectOne('/api/want-to-have/1').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(detailModal().record()).not.toBeNull();
    expect(all('want-to-have-item').length).toBe(1);
  });
});
