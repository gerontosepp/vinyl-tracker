import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ShelfViewComponent, STORAGE_PRESETS } from './shelf-view.component';
import { ApiService } from '../../../../core/services/api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { StorageLayout, StorageType, StorageUnit } from '../../../../core/types';

const kallax: StorageType = { id: 1, name: 'Kallax 2×2', media: 'vinyl', rows: 2, columns: 2, capacity: 70, unitCount: 2 };
const cdShelf: StorageType = { id: 2, name: 'IKEA CD-Regal', media: 'cd', rows: 12, columns: 1, capacity: 11, unitCount: 0 };
const units: StorageUnit[] = [
  { id: 10, name: 'Kallax-1', typeId: 1, media: 'vinyl', sortOrder: 1 },
  { id: 11, name: 'Kallax-2', typeId: 1, media: 'vinyl', sortOrder: 2 },
];
const layout: StorageLayout = {
  media: [
    {
      media: 'vinyl',
      unplacedCount: 3,
      units: [
        {
          id: 10,
          name: 'Kallax-1',
          typeName: 'Kallax 2×2',
          rows: 1,
          columns: 2,
          compartments: [
            { number: 1, row: 1, column: 1, capacity: 70, used: 68, count: 60, firstArtist: 'Abba', lastArtist: 'Beatles', oversized: false },
            { number: 2, row: 1, column: 2, capacity: 70, used: 0, count: 0, firstArtist: null, lastArtist: null, oversized: false },
          ],
        },
      ],
    },
  ],
};

describe('ShelfViewComponent', () => {
  let fixture: ComponentFixture<ShelfViewComponent>;
  let component: ShelfViewComponent;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let toast: { showToast: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = {
      getStorageTypes: vi.fn().mockReturnValue(of([kallax, cdShelf])),
      getStorageUnits: vi.fn().mockReturnValue(of(units)),
      getStorageLayout: vi.fn().mockReturnValue(of(layout)),
      createStorageType: vi.fn().mockReturnValue(of({ types: [kallax, cdShelf], redistributed: [] })),
      updateStorageType: vi.fn().mockReturnValue(of({ types: [kallax], redistributed: ['vinyl'] })),
      deleteStorageType: vi.fn().mockReturnValue(of({ types: [kallax], redistributed: [] })),
      createStorageUnit: vi.fn().mockReturnValue(of({ units, redistributed: ['vinyl'] })),
      updateStorageUnit: vi.fn().mockReturnValue(of({ units, redistributed: [] })),
      deleteStorageUnit: vi.fn().mockReturnValue(of({ units: [units[0]], redistributed: ['vinyl'] })),
      reorderStorageUnits: vi.fn().mockReturnValue(of({ units: [units[1], units[0]], redistributed: ['vinyl'] })),
      previewRedistribution: vi.fn().mockReturnValue(of({ media: 'vinyl', movedCount: 12 })),
      redistribute: vi.fn().mockReturnValue(of(layout)),
    };
    toast = { showToast: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ShelfViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');

    fixture = TestBed.createComponent(ShelfViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const el = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  it('loads types, shelves and the overview with fill level and artist range', () => {
    expect(component.types().length).toBe(2);
    expect(component.mediaWithUnits()).toEqual(['vinyl']);

    const compartments = fixture.nativeElement.querySelectorAll('[data-testid="compartment"]');
    expect(compartments.length).toBe(2);
    expect(compartments[0].textContent).toContain('68 / 70');
    expect(compartments[0].textContent).toContain('Abba – Beatles');
    expect(compartments[1].textContent).toContain('leer');
    expect(el('unplaced-count')?.textContent).toContain('3 Platten ohne Platz');
  });

  it('opens the collection filtered to a clicked compartment or to the records without space', () => {
    const selected: string[] = [];
    component.filterSelected.subscribe((value) => selected.push(value));

    (fixture.nativeElement.querySelectorAll('[data-testid="compartment"]')[1] as HTMLElement).click();
    el('unplaced-count')!.click();

    const unitId = component.layout()!.media[0].units[0].id;
    expect(selected).toEqual([`${unitId}:2`, 'unplaced']);
  });

  it('shows the management only on demand once shelves exist', () => {
    expect(el('type-list')).toBeNull();
    expect(el('manage-toggle')?.textContent).toContain('Regale verwalten');

    el('manage-toggle')!.click();
    fixture.detectChanges();
    expect(el('unit-list-vinyl')?.textContent).toContain('Kallax-2');
    expect(el('manage-toggle')?.textContent).toContain('Fertig');
  });

  it('opens the management directly before the first shelf', () => {
    component.units.set([]);
    fixture.detectChanges();
    expect(el('manage-toggle')).toBeNull();
    expect(el('type-list')).not.toBeNull();
  });

  it('only offers deleting unused storage types', () => {
    component.managing.set(true);
    fixture.detectChanges();
    const typeList = el('type-list')!;
    const rows = typeList.querySelectorAll('li');
    expect(rows[0].textContent).not.toContain('Löschen');
    expect(rows[1].textContent).toContain('Löschen');
  });

  it('creates a storage type from a preset', () => {
    component.startNewType();
    expect(component.typeForm()?.name).toBe('Kallax 2×4');
    expect(component.typeForm()?.capacity).toBe(70);

    component.applyPreset('ikea-cd');
    const form = component.typeForm()!;
    expect(form).toMatchObject({ media: 'cd', rows: 12, columns: 1, capacity: 11 });

    component.saveType();
    expect(api['createStorageType']).toHaveBeenCalledWith({
      name: 'IKEA CD-Regal',
      media: 'cd',
      rows: 12,
      columns: 1,
      capacity: 11,
    });
    expect(component.typeForm()).toBeNull();
    expect(toast.showToast).toHaveBeenCalledWith('Gespeichert', 'success');
  });

  it('keeps own values for the custom preset and reports redistribution after editing', () => {
    component.editType(kallax);
    component.applyPreset('custom');
    expect(component.typeForm()?.name).toBe('Kallax 2×2');

    component.saveType();
    expect(api['updateStorageType']).toHaveBeenCalledWith(1, expect.objectContaining({ rows: 2, capacity: 70 }));
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining('neu auf die Regale verteilt'), 'info');
  });

  it('creates, renames and deletes shelves', () => {
    component.startNewUnit();
    component.unitForm.set({ id: null, name: 'Kallax-3', typeId: 1 });
    component.saveUnit();
    expect(api['createStorageUnit']).toHaveBeenCalledWith('Kallax-3', 1);

    component.editUnit(units[0]);
    component.unitForm.set({ id: 10, name: 'Wohnzimmer', typeId: 1 });
    component.saveUnit();
    expect(api['updateStorageUnit']).toHaveBeenCalledWith(10, 'Wohnzimmer', 1);

    component.deleteUnit(units[1]);
    expect(api['deleteStorageUnit']).toHaveBeenCalledWith(11);
    expect(component.units().length).toBe(1);
  });

  it('reorders shelves of a medium', () => {
    component.moveUnit(units[1], -1);
    expect(api['reorderStorageUnits']).toHaveBeenCalledWith('vinyl', [11, 10]);
    expect(component.units()[0].name).toBe('Kallax-2');

    api['reorderStorageUnits'].mockClear();
    component.moveUnit(component.units()[0], -1);
    expect(api['reorderStorageUnits']).not.toHaveBeenCalled();
  });

  it('asks before redistributing and shows the number of moved records', () => {
    el('redistribute-vinyl')!.click();
    fixture.detectChanges();
    expect(el('redistribute-confirm')?.textContent).toContain('12 Platten');

    component.confirmRedistribute();
    fixture.detectChanges();
    expect(api['redistribute']).toHaveBeenCalledWith('vinyl');
    expect(el('redistribute-confirm')).toBeNull();
  });

  it('shows server errors as toast', () => {
    api['createStorageType'].mockReturnValue(throwError(() => new Error('Name exists')));
    component.startNewType();
    component.saveType();
    expect(toast.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(component.typeForm()).not.toBeNull();
    expect(component.saving()).toBe(false);
  });

  it('offers presets for Kallax and the IKEA CD shelf', () => {
    expect(STORAGE_PRESETS.filter((p) => p.media === 'vinyl').every((p) => p.capacity === 70)).toBe(true);
    expect(STORAGE_PRESETS.find((p) => p.media === 'cd')).toMatchObject({ rows: 12, columns: 1, capacity: 11 });
  });
});
