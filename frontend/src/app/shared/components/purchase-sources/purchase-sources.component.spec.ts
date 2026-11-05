import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PurchaseSourcesComponent, VISIBLE_VERSIONS } from './purchase-sources.component';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { MarketplaceStats, PurchaseSources, VinylVersion } from '../../../core/types';

const stats = (releaseId: number, price: number | null, offers: number, blocked = false): MarketplaceStats => ({
  release_id: releaseId,
  lowest_price: price,
  currency: 'EUR',
  num_for_sale: offers,
  blocked_from_sale: blocked,
});

const version = (releaseId: number, over: Partial<VinylVersion> = {}): VinylVersion => ({
  release_id: releaseId,
  title: `Phaedra ${releaseId}`,
  label: 'Virgin',
  catno: 'V 2010',
  country: 'UK',
  released: '1974-02-01',
  format: 'LP',
  thumb: null,
  is_wanted: false,
  marketplace_url: `https://www.discogs.com/sell/release/${releaseId}`,
  stats: null,
  ...over,
});

const sources = (versions: VinylVersion[], over: Partial<PurchaseSources> = {}): PurchaseSources => ({
  discogs_id: 1,
  master_id: 55,
  currency: 'EUR',
  versions,
  total_versions: versions.length,
  truncated: false,
  shop_links: [
    { shop: 'discogs', name: 'Discogs', url: 'https://www.discogs.com/sell/list?master_id=55&format=Vinyl' },
    { shop: 'ebay', name: 'eBay', url: 'https://www.ebay.de/sch/i.html?_nkw=Tangerine%20Dream' },
  ],
  ...over,
});

describe('PurchaseSourcesComponent', () => {
  let fixture: ComponentFixture<PurchaseSourcesComponent>;
  let http: HttpTestingController;
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { showToast: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PurchaseSourcesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ToastService, useValue: toast }],
    });
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PurchaseSourcesComponent);
    fixture.componentRef.setInput('wantToHaveId', 1);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => fixture.nativeElement;
  const q = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (selector: string) => el().querySelectorAll<HTMLElement>(selector);
  const sourcesUrl = '/api/want-to-have/1/sources';

  async function open(data: PurchaseSources): Promise<void> {
    q('sources-toggle')!.click();
    http.expectOne({ url: sourcesUrl, method: 'GET' }).flush(data);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('requests nothing before the section is opened', () => {
    http.expectNone(sourcesUrl);
    expect(q('sources-loading')).toBeNull();
    expect(q('shop-link-ebay')).toBeNull();
  });

  it('loads the sources when opened and shows a loading hint meanwhile', () => {
    q('sources-toggle')!.click();
    fixture.detectChanges();

    expect(q('sources-loading')).not.toBeNull();
    http.expectOne({ url: sourcesUrl, method: 'GET' }).flush(sources([version(1)]));
  });

  it('does not request again when closed and reopened', async () => {
    await open(sources([version(1)]));

    q('sources-toggle')!.click();
    q('sources-toggle')!.click();
    fixture.detectChanges();

    http.expectNone(sourcesUrl);
    expect(q('version-1')).not.toBeNull();
  });

  it('opens shop links in a new tab without opener access', async () => {
    await open(sources([version(1)]));

    const link = q('shop-link-ebay') as HTMLAnchorElement;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.href).toContain('https://www.ebay.de/');
    expect(link.textContent).toContain('eBay');
  });

  it('highlights only the wanted version', async () => {
    await open(sources([version(1, { is_wanted: true }), version(2)]));

    expect(q('version-1')!.querySelector('[data-testid="wanted-badge"]')).not.toBeNull();
    expect(q('version-2')!.querySelector('[data-testid="wanted-badge"]')).toBeNull();
    expect(all('[data-testid="wanted-badge"]').length).toBe(1);
  });

  it('describes a pressing by label, catalog number, country, year and format', async () => {
    await open(sources([version(1)]));

    expect(q('version-1')!.textContent).toContain('Virgin · V 2010 · UK · 1974 · LP');
  });

  it('falls back to the title when Discogs knows no details', async () => {
    const bare = version(1, { label: null, catno: null, country: null, released: null, format: null });
    await open(sources([bare]));

    expect(q('version-1')!.textContent).toContain('Phaedra 1');
  });

  it('links every version to its Discogs marketplace page', async () => {
    await open(sources([version(7)]));

    const link = q('version-7')!.querySelector<HTMLAnchorElement>('a')!;
    expect(link.href).toBe('https://www.discogs.com/sell/release/7');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows the lowest price and the number of offers in the local number format', async () => {
    await open(sources([version(1, { stats: stats(1, 12.5, 23) })]));

    const text = q('stats-1')!.textContent!.replace(/\s/g, ' ');
    expect(text).toContain('ab 12,50 €');
    expect(text).toContain('23 Angebote');
  });

  it('formats prices in English when the language is English', async () => {
    TestBed.inject(LanguageService).setLanguage('en');
    await open(sources([version(1, { stats: stats(1, 12.5, 23) })]));

    expect(q('stats-1')!.textContent).toContain('from €12.50');
    expect(q('stats-1')!.textContent).toContain('23 offers');
  });

  it('says so when nothing is for sale', async () => {
    await open(sources([version(1, { stats: stats(1, null, 0) })]));

    expect(q('stats-1')!.textContent).toContain('Derzeit nicht im Angebot');
  });

  it('says so when a release is blocked from sale', async () => {
    await open(sources([version(1, { stats: stats(1, null, 0, true) })]));

    expect(q('stats-1')!.textContent).toContain('Nicht zum Verkauf freigegeben');
  });

  it('offers to load the price of a version without figures', async () => {
    await open(sources([version(1, { stats: stats(1, 9, 1) }), version(2)]));

    expect(q('load-price-1')).toBeNull();
    expect(q('load-price-2')).not.toBeNull();
  });

  it('loads the price of one version on demand and shows it', async () => {
    await open(sources([version(2)]));

    q('load-price-2')!.click();
    http.expectOne({ url: '/api/want-to-have/1/sources/2/stats', method: 'GET' }).flush(stats(2, 30, 5));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('load-price-2')).toBeNull();
    expect(q('stats-2')!.textContent).toContain('30,00');
    expect(q('stats-2')!.textContent).toContain('5 Angebote');
  });

  it('asks for a version only once while its price is loading', async () => {
    await open(sources([version(2)]));

    q('load-price-2')!.click();
    fixture.detectChanges();
    expect((q('load-price-2') as HTMLButtonElement).disabled).toBe(true);
    q('load-price-2')!.click();

    http.expectOne({ url: '/api/want-to-have/1/sources/2/stats', method: 'GET' }).flush(stats(2, 30, 5));
  });

  it('keeps the button and tells the user when a price cannot be loaded', async () => {
    await open(sources([version(2)]));

    q('load-price-2')!.click();
    http
      .expectOne({ url: '/api/want-to-have/1/sources/2/stats', method: 'GET' })
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toast.showToast).toHaveBeenCalledWith('Preis konnte nicht geladen werden.', 'error');
    expect((q('load-price-2') as HTMLButtonElement).disabled).toBe(false);
  });

  it('names the Discogs limit when a price request is rate limited', async () => {
    await open(sources([version(2)]));

    q('load-price-2')!.click();
    http
      .expectOne({ url: '/api/want-to-have/1/sources/2/stats', method: 'GET' })
      .flush(null, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();

    expect(toast.showToast).toHaveBeenCalledWith('Discogs-Limit erreicht – bitte gleich erneut versuchen.', 'error');
  });

  it('shows the first versions and the rest on request', async () => {
    const many = Array.from({ length: VISIBLE_VERSIONS + 2 }, (_, i) => version(i + 1));
    await open(sources(many));
    expect(all('li[data-testid^="version-"]').length).toBe(VISIBLE_VERSIONS);

    q('sources-show-all')!.click();
    fixture.detectChanges();
    expect(all('li[data-testid^="version-"]').length).toBe(VISIBLE_VERSIONS + 2);

    q('sources-show-all')!.click();
    fixture.detectChanges();
    expect(all('li[data-testid^="version-"]').length).toBe(VISIBLE_VERSIONS);
  });

  it('has no show-all button for a short list', async () => {
    await open(sources([version(1), version(2)]));

    expect(q('sources-show-all')).toBeNull();
  });

  it('points out that Discogs knows more versions than are shown', async () => {
    await open(sources([version(1)], { truncated: true, total_versions: 450 }));

    expect(q('sources-truncated')!.textContent).toContain('450');
  });

  it('shows no truncation hint for a complete list', async () => {
    await open(sources([version(1)]));

    expect(q('sources-truncated')).toBeNull();
  });

  it('tells the user about the Discogs limit and lets them retry', async () => {
    q('sources-toggle')!.click();
    http
      .expectOne({ url: sourcesUrl, method: 'GET' })
      .flush(null, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('sources-error')!.textContent).toContain('Discogs-Limit erreicht');
    expect(toast.showToast).toHaveBeenCalledWith('Discogs-Limit erreicht – bitte gleich erneut versuchen.', 'error');

    q('sources-retry')!.click();
    http.expectOne({ url: sourcesUrl, method: 'GET' }).flush(sources([version(1)]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(q('sources-error')).toBeNull();
    expect(q('version-1')).not.toBeNull();
  });

  it('shows a general error for other failures', async () => {
    q('sources-toggle')!.click();
    http.expectOne({ url: sourcesUrl, method: 'GET' }).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('sources-error')!.textContent).toContain('Bezugsquellen konnten nicht geladen werden');
    expect(toast.showToast).toHaveBeenCalledWith('Bezugsquellen konnten nicht geladen werden.', 'error');
  });

  it('shows no error toast for an answer that arrives after another entry was opened', async () => {
    q('sources-toggle')!.click();
    const pending = http.expectOne({ url: sourcesUrl, method: 'GET' });

    fixture.componentRef.setInput('wantToHaveId', 2);
    fixture.detectChanges();
    pending.flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(toast.showToast).not.toHaveBeenCalled();
  });

  it('starts over when another entry is shown', async () => {
    await open(sources([version(1)]));

    fixture.componentRef.setInput('wantToHaveId', 2);
    fixture.detectChanges();

    expect(q('version-1')).toBeNull();
    expect(q('sources-toggle')!.getAttribute('aria-expanded')).toBe('false');
    http.expectNone('/api/want-to-have/2/sources');
  });

  it('ignores a late answer for an entry that is no longer shown', async () => {
    q('sources-toggle')!.click();
    const pending = http.expectOne({ url: sourcesUrl, method: 'GET' });

    fixture.componentRef.setInput('wantToHaveId', 2);
    fixture.detectChanges();
    pending.flush(sources([version(1)]));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('version-1')).toBeNull();
  });
});
