import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DiscogsCandidate, RecordDetailDto, TakeoverResult } from '../../../../core/types';
import { contributionText, DISCOGS_ADD_RELEASE_URL, DiscogsTakeoverComponent } from './discogs-takeover.component';

describe('DiscogsTakeoverComponent', () => {
  let fixture: ComponentFixture<DiscogsTakeoverComponent>;
  let component: DiscogsTakeoverComponent;
  let api: { getDiscogsCandidates: ReturnType<typeof vi.fn>; takeOverManualRecord: ReturnType<typeof vi.fn> };
  let toast: { showToast: ReturnType<typeof vi.fn> };

  const detail: RecordDetailDto = {
    discogs_id: -3,
    title: 'Posen',
    artist: 'Die Sterne',
    year: '1996',
    format: 'LP',
    genres: [],
    in_collection: true,
    listen_count: 0,
    tracklist: [],
    formats: [],
    labels: [{ name: "L'age D'or", catno: 'LADO 17053' } as any],
    country: 'Germany',
    barcode: '4006381333931',
    notes: '  ',
    source: 'manual',
  };

  const candidate = (discogsId: number, inCollection: number[] = []): DiscogsCandidate => ({
    discogsId,
    artist: 'Die Sterne',
    title: 'Posen',
    year: '1996',
    label: "L'age D'or",
    catno: 'LADO 17053',
    format: 'Vinyl, LP',
    country: 'Germany',
    thumbUrl: 'https://i.discogs.com/1.jpg',
    matchedBy: 'barcode',
    inCollection,
  });

  const result: TakeoverResult = {
    record: { ...detail, discogs_id: 1001, source: 'discogs' },
    instanceId: 555,
    mode: 'new_copy',
  };

  const q = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const click = (testId: string): void => {
    (q(testId) as HTMLElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    api = {
      getDiscogsCandidates: vi.fn().mockReturnValue(of([candidate(1001), candidate(1002, [77, 78])])),
      takeOverManualRecord: vi.fn().mockReturnValue(of(result)),
    };
    toast = { showToast: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [DiscogsTakeoverComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        LanguageService,
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    fixture = TestBed.createComponent(DiscogsTakeoverComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges();
  });

  it('lists the candidates of the check and marks owned releases', () => {
    click('takeover-check');

    expect(api.getDiscogsCandidates).toHaveBeenCalledWith(-3);
    const list = q('takeover-candidates')!;
    expect(list.textContent).toContain('Die Sterne – Posen');
    expect(list.textContent).toContain("L'age D'or · LADO 17053 · Vinyl, LP · Germany · 1996 · Discogs 1001");
    expect(list.textContent).toContain('Barcode');
    expect(list.querySelectorAll('img').length).toBe(2);
    expect(list.textContent?.match(/Bereits in der Sammlung/g)?.length).toBe(1);
  });

  it('reports no match and search errors', () => {
    api.getDiscogsCandidates.mockReturnValueOnce(of([]));
    click('takeover-check');
    expect(q('takeover-no-match')?.textContent).toContain('Kein Treffer bei Discogs');

    api.getDiscogsCandidates.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    click('takeover-check');
    expect(toast.showToast).toHaveBeenCalledWith('Die Suche bei Discogs ist fehlgeschlagen.', 'error');
    expect(component.checking()).toBe(false);
  });

  it('takes over a release as a new copy only after confirmation', () => {
    const emitted: TakeoverResult[] = [];
    component.takenOver.subscribe((r) => emitted.push(r));
    click('takeover-check');
    click('takeover-select-1001');

    expect(api.takeOverManualRecord).not.toHaveBeenCalled();
    expect(q('takeover-confirm')?.textContent).toContain('„Die Sterne – Posen“ (Discogs 1001)');
    // Not owned yet: no choice between second copy and merge
    expect(q('takeover-mode-merge')).toBeNull();

    click('takeover-submit');

    expect(api.takeOverManualRecord).toHaveBeenCalledWith(-3, { releaseId: 1001, mode: 'new_copy', targetInstanceId: null });
    expect(emitted).toEqual([result]);
    expect(toast.showToast).toHaveBeenCalledWith('Die Platte ist jetzt eine Discogs-Platte.', 'success');
  });

  it('merges into the chosen existing copy', () => {
    click('takeover-check');
    click('takeover-select-1002');
    expect((q('takeover-mode-new_copy') as HTMLInputElement).checked).toBe(true);

    click('takeover-mode-merge');
    const target = q('takeover-target') as HTMLSelectElement;
    expect(target.options.length).toBe(2);
    target.value = '78';
    target.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    click('takeover-submit');

    expect(api.takeOverManualRecord).toHaveBeenCalledWith(-3, { releaseId: 1002, mode: 'merge', targetInstanceId: 78 });
    expect(toast.showToast).toHaveBeenCalledWith(
      'Die Platte wurde mit dem vorhandenen Exemplar zusammengeführt.',
      'success'
    );
  });

  it('keeps the record manual when the takeover fails and allows going back', () => {
    api.takeOverManualRecord.mockReturnValueOnce(throwError(() => ({ status: 502 })));
    const emitted: TakeoverResult[] = [];
    component.takenOver.subscribe((r) => emitted.push(r));
    click('takeover-check');
    click('takeover-select-1001');
    click('takeover-submit');

    expect(emitted).toEqual([]);
    expect(toast.showToast).toHaveBeenCalledWith('Die Übernahme ist fehlgeschlagen; die Platte bleibt manuell.', 'error');
    expect(component.running()).toBe(false);

    click('takeover-back');
    expect(q('takeover-confirm')).toBeNull();
    expect(q('takeover-candidates')).not.toBeNull();
  });

  it('forgets the results of the previous record when another one is shown', () => {
    click('takeover-check');
    click('takeover-select-1001');
    expect(q('takeover-confirm')).not.toBeNull();

    fixture.componentRef.setInput('detail', { ...detail, discogs_id: -4 });
    fixture.detectChanges();

    expect(q('takeover-confirm')).toBeNull();
    expect(q('takeover-candidates')).toBeNull();
    click('takeover-check');
    expect(api.getDiscogsCandidates).toHaveBeenLastCalledWith(-4);
  });

  it('links the Discogs form and copies the record data', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const link = q('takeover-contribute') as HTMLAnchorElement;
    expect(link.href).toBe(DISCOGS_ADD_RELEASE_URL);
    expect(link.target).toBe('_blank');

    await component.copyData();
    expect(writeText).toHaveBeenCalledWith(contributionText(detail));
    expect(toast.showToast).toHaveBeenCalledWith('Daten in die Zwischenablage kopiert', 'success');

    writeText.mockRejectedValueOnce(new Error('denied'));
    await component.copyData();
    expect(toast.showToast).toHaveBeenCalledWith('Kopieren nicht möglich', 'error');
  });

  it('builds the contribution text from the filled fields only', () => {
    expect(contributionText(detail)).toBe(
      [
        'Artist: Die Sterne',
        'Title: Posen',
        'Format: LP',
        'Year: 1996',
        "Label: L'age D'or",
        'Catalog#: LADO 17053',
        'Country: Germany',
        'Barcode: 4006381333931',
      ].join('\n')
    );
    expect(contributionText({ ...detail, labels: [], year: undefined, barcode: undefined, country: undefined })).toBe(
      'Artist: Die Sterne\nTitle: Posen\nFormat: LP'
    );
  });
});
