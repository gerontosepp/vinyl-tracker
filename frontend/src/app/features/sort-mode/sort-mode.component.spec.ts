import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SortModeComponent } from './sort-mode.component';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';
import { WakeLockService } from '../../core/services/wake-lock.service';
import { StorageLayout, StorageSequence, StorageSlot } from '../../core/types';

const layout: StorageLayout = {
  media: [
    {
      media: 'vinyl',
      unplacedCount: 1,
      units: [
        { id: 1, name: 'Kallax-1', typeName: 'Kallax 1×2', rows: 1, columns: 2, compartments: [] },
        { id: 2, name: 'Kallax-2', typeName: 'Kallax 2×2', rows: 2, columns: 2, compartments: [] },
      ],
    },
    {
      media: 'cd',
      unplacedCount: 0,
      units: [{ id: 5, name: 'CD-1', typeName: 'CD', rows: 12, columns: 1, compartments: [] }],
    },
  ],
};

const slot = (unitId: number | null, compartment: number | null, row = 1, column = compartment): StorageSlot => ({
  unitId,
  unitName: unitId == null ? null : `Kallax-${unitId}`,
  compartment,
  row: unitId == null ? null : row,
  column: unitId == null ? null : column,
  oversized: false,
  unplaced: unitId == null,
});

const sequence: StorageSequence = {
  media: 'vinyl',
  items: [
    { discogsId: 1, instanceId: 1, artist: 'Abba', title: 'Gold', thumbUrl: 'https://i.discogs.com/1.jpg', slot: slot(1, 1) },
    { discogsId: 2, instanceId: 2, artist: 'Beatles', title: 'Help', thumbUrl: null, slot: slot(1, 2) },
    { discogsId: 3, instanceId: 3, artist: 'Cream', title: 'Fresh', thumbUrl: null, slot: slot(1, 2) },
    { discogsId: 4, instanceId: 4, artist: null, title: 'Untitled', thumbUrl: null, slot: slot(2, 3, 2, 1) },
    { discogsId: 5, instanceId: 5, artist: 'Zappa', title: 'Hot Rats', thumbUrl: null, slot: slot(null, null) },
  ],
};

describe('SortModeComponent', () => {
  let fixture: ComponentFixture<SortModeComponent>;
  let component: SortModeComponent;
  let api: { getStorageLayout: ReturnType<typeof vi.fn>; getStorageSequence: ReturnType<typeof vi.fn>; getProxiedImageUrl: ReturnType<typeof vi.fn> };
  let toast: { showToast: ReturnType<typeof vi.fn> };
  let wakeLock: { acquire: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  async function setup(layoutResult = of(layout)): Promise<void> {
    api = {
      getStorageLayout: vi.fn().mockReturnValue(layoutResult),
      getStorageSequence: vi.fn().mockReturnValue(of(sequence)),
      getProxiedImageUrl: vi.fn().mockImplementation((url: string) => `proxy:${url}`),
    };
    toast = { showToast: vi.fn() };
    wakeLock = { acquire: vi.fn().mockResolvedValue(undefined), release: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [SortModeComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: WakeLockService, useValue: wakeLock },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(() => Promise.resolve(true)) as unknown as ReturnType<typeof vi.fn>;
    TestBed.inject(LanguageService).setLanguage('de');

    fixture = TestBed.createComponent(SortModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const el = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const click = (testId: string): void => {
    el(testId)!.click();
    fixture.detectChanges();
  };

  it('preselects the first shelf and validates row and column against its grid', async () => {
    await setup();
    expect(component.shelfId()).toBe(1);
    expect(el('sort-shelf')).not.toBeNull();
    expect(el('sort-grid-hint')?.textContent).toContain('1 Zeilen und 2 Spalten');

    component.column.set(3);
    fixture.detectChanges();
    expect(component.startValid()).toBe(false);
    expect((el('sort-start') as HTMLButtonElement).disabled).toBe(true);

    component.shelfId.set(2);
    component.row.set(2);
    expect(component.startValid()).toBe(false); // Kallax-2 has 2 columns
    component.column.set(2);
    expect(component.startValid()).toBe(true);
    component.row.set(1.5);
    expect(component.rowValid()).toBe(false);
  });

  it('starts at the chosen compartment with its compartment, progress and highlight', async () => {
    await setup();
    component.column.set(2);
    click('sort-start');

    expect(api.getStorageSequence).toHaveBeenCalledWith('vinyl');
    expect(wakeLock.acquire).toHaveBeenCalled();
    expect(el('sort-title')?.textContent).toContain('Help');
    expect(el('sort-artist')?.textContent).toContain('Beatles');
    expect(el('sort-slot')?.textContent).toContain('Kallax-1 · 1:2');
    expect(el('sort-progress')?.textContent?.trim()).toBe('1 / 2');
    expect(el('sort-new-compartment')).not.toBeNull();
    expect((el('sort-back') as HTMLButtonElement).disabled).toBe(true);

    click('sort-next');
    expect(el('sort-title')?.textContent).toContain('Fresh');
    expect(el('sort-progress')?.textContent?.trim()).toBe('2 / 2');
    expect(el('sort-new-compartment')).toBeNull();

    click('sort-back');
    expect(el('sort-title')?.textContent).toContain('Help');
    click('sort-back'); // nothing before the start
    expect(el('sort-title')?.textContent).toContain('Help');
  });

  it('continues on the next shelf, then the records without space, then finishes', async () => {
    await setup();
    component.column.set(2);
    click('sort-start');
    click('sort-next');
    click('sort-next');

    expect(el('sort-slot')?.textContent).toContain('Kallax-2 · 2:1');
    expect(el('sort-new-compartment')).not.toBeNull();
    expect(el('sort-artist')?.textContent).toContain('Unbekannter Künstler');

    click('sort-next');
    expect(el('sort-slot')?.textContent).toContain('Ohne Platz');

    click('sort-next');
    expect(el('sort-done')).not.toBeNull();
    expect(el('sort-done-count')?.textContent).toContain('4 Platten sortiert');
    expect(wakeLock.release).toHaveBeenCalled();

    click('sort-home');
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows the cover through the image proxy and preloads the next one', async () => {
    await setup();
    const images: string[] = [];
    const original = window.Image;
    window.Image = class {
      set src(value: string) {
        images.push(value);
      }
    } as unknown as typeof Image;
    try {
      component.shelfId.set(1);
      click('sort-start');
      expect(fixture.nativeElement.querySelector('[data-testid="sort-screen"] img')?.getAttribute('src')).toBe(
        'proxy:https://i.discogs.com/1.jpg'
      );
      expect(component.coverUrl(sequence.items[1])).toBeNull();
    } finally {
      window.Image = original;
    }
    expect(images).toEqual([]); // the next copy has no cover
  });

  it('preloads the cover of the next copy', async () => {
    await setup();
    const images: string[] = [];
    const original = window.Image;
    window.Image = class {
      set src(value: string) {
        images.push(value);
      }
    } as unknown as typeof Image;
    try {
      component.items.set([sequence.items[1], sequence.items[0]]);
      component.index.set(0);
      fixture.detectChanges();
      expect(images).toContain('proxy:https://i.discogs.com/1.jpg');
    } finally {
      window.Image = original;
    }
  });

  it('finishes immediately when no record follows the start', async () => {
    await setup();
    api.getStorageSequence.mockReturnValue(of({ media: 'cd', items: [] }));
    component.shelfId.set(5);
    click('sort-start');
    expect(el('sort-done-count')?.textContent).toContain('0 Platten sortiert');
    expect(wakeLock.acquire).not.toHaveBeenCalled();
  });

  it('quits from the start screen and while sorting', async () => {
    await setup();
    click('sort-cancel');
    expect(navigate).toHaveBeenCalledWith(['/']);

    click('sort-start');
    expect(wakeLock.acquire).toHaveBeenCalledTimes(1);
    const released = wakeLock.release.mock.calls.length;
    click('sort-end');
    expect(wakeLock.release).toHaveBeenCalledTimes(released + 1);
    expect(navigate).toHaveBeenCalledTimes(2);

    fixture.destroy();
    expect(wakeLock.release).toHaveBeenCalledTimes(released + 2);
  });

  it('explains what to do without shelves', async () => {
    await setup(of({ media: [] }));
    expect(el('sort-no-shelves')).not.toBeNull();
    expect(el('sort-start')).toBeNull();
    component.start();
    expect(api.getStorageSequence).not.toHaveBeenCalled();
  });

  it('reports loading errors as toast', async () => {
    await setup(throwError(() => new Error('down')));
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(component.loading()).toBe(false);

    TestBed.resetTestingModule();
    await setup();
    api.getStorageSequence.mockReturnValue(throwError(() => new Error('down')));
    click('sort-start');
    expect(component.state()).toBe('setup');
    expect(component.starting()).toBe(false);
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
