import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StoragePlacementComponent } from './storage-placement.component';
import { LanguageService } from '../../../core/services/language.service';
import { StorageMove, StorageNeighbors, StorageSlot } from '../../../core/types';

const slot = (compartment: number, unitName = 'Kallax-2'): StorageSlot => ({
  unitId: unitName === 'Kallax-2' ? 2 : 1,
  unitName,
  compartment,
  row: 1,
  column: compartment,
  oversized: false,
  unplaced: false,
});

const move = (id: number, artist: string, from: number, to: number): StorageMove => ({
  record: { discogsId: id, artist, title: `Album ${id}` },
  from: slot(from),
  to: slot(to),
});

describe('StoragePlacementComponent', () => {
  let fixture: ComponentFixture<StoragePlacementComponent>;

  async function setup(inputs: {
    slot: StorageSlot;
    neighbors?: StorageNeighbors | null;
    moves?: StorageMove[];
    showMoves?: boolean;
  }): Promise<void> {
    await TestBed.configureTestingModule({ imports: [StoragePlacementComponent] }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    fixture = TestBed.createComponent(StoragePlacementComponent);
    fixture.componentRef.setInput('slot', inputs.slot);
    if (inputs.neighbors !== undefined) fixture.componentRef.setInput('neighbors', inputs.neighbors);
    if (inputs.moves) fixture.componentRef.setInput('moves', inputs.moves);
    if (inputs.showMoves) fixture.componentRef.setInput('showMoves', true);
    fixture.detectChanges();
  }

  const text = (testId: string): string =>
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows shelf, compartment, grid position and both neighbors', async () => {
    await setup({
      slot: slot(3),
      neighbors: {
        previous: { discogsId: 1, artist: 'Miles Davis', title: 'Kind of Blue' },
        next: { discogsId: 2, artist: null, title: 'Untitled' },
      },
    });

    expect(text('placement-slot')).toBe('Kallax-2 · Fach 3 (Zeile 1, Spalte 3)');
    expect(text('placement-neighbors')).toContain('nach: Miles Davis – Kind of Blue');
    expect(text('placement-neighbors')).toContain('vor: Untitled');
    expect(text('placement-moves')).toBe('');
    // The move list is only shown right after adding a record.
    expect(text('placement-no-moves')).toBe('');
  });

  it('names the shelf ends when there is no neighbor', async () => {
    await setup({ slot: slot(1), neighbors: { previous: null, next: null } });
    expect(text('placement-neighbors')).toContain('nach: ganz vorne');
    expect(text('placement-neighbors')).toContain('vor: ganz hinten');
  });

  it('reports that nothing has to move', async () => {
    await setup({ slot: slot(3), showMoves: true });
    expect(text('placement-no-moves')).toBe('Keine anderen Platten müssen umgestellt werden.');
  });

  it('groups the moved records by compartment transition', async () => {
    await setup({
      slot: slot(3),
      showMoves: true,
      moves: [move(10, 'Abba', 3, 4), move(11, 'Beatles', 4, 5), move(12, 'Bowie', 4, 5)],
    });

    expect(fixture.componentInstance.moveGroups().length).toBe(2);
    const moves = text('placement-moves');
    expect(moves).toContain('Dafür wandern 3 Platten in ein anderes Fach:');
    expect(moves).toContain('Kallax-2 · 3 → Kallax-2 · 4: Abba – Album 10');
    expect(moves).toContain('Kallax-2 · 4 → Kallax-2 · 5: Beatles – Album 11, Bowie – Album 12');
  });

  it('warns when there is no space left and flags oversized boxes', async () => {
    await setup({ slot: { ...slot(1), unplaced: true, unitName: null, compartment: null } });
    expect(text('placement-unplaced')).toContain('kein Platz mehr frei');
    expect(text('placement-neighbors')).toBe('');

    fixture.componentRef.setInput('slot', { ...slot(2), oversized: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Übergroß');
  });
});
