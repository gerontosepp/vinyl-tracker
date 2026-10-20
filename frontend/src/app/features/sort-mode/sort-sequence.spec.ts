import { StorageSequenceItem, StorageSlot } from '../../core/types';
import { compartmentProgress, isNewCompartment, slotKey, startIndex } from './sort-sequence';

const slot = (unitId: number | null, compartment: number | null): StorageSlot => ({
  unitId,
  unitName: unitId == null ? null : `Kallax-${unitId}`,
  compartment,
  row: compartment == null ? null : 1,
  column: compartment,
  oversized: false,
  unplaced: unitId == null,
});

const item = (n: number, s: StorageSlot): StorageSequenceItem => ({
  discogsId: n,
  instanceId: n,
  artist: `Artist ${n}`,
  title: `Title ${n}`,
  thumbUrl: null,
  slot: s,
});

// Kallax-1: compartment 1 (2 copies), 3 (1 copy); compartment 2 is empty.
// Kallax-2: compartment 1 (2 copies); then 1 copy without place.
const items = [
  item(1, slot(1, 1)),
  item(2, slot(1, 1)),
  item(3, slot(1, 3)),
  item(4, slot(2, 1)),
  item(5, slot(2, 1)),
  item(6, slot(null, null)),
];
const order = [1, 2];

describe('sort sequence', () => {
  it('keys compartments and copies without place', () => {
    expect(slotKey(slot(1, 3))).toBe('1:3');
    expect(slotKey(slot(null, null))).toBe('unplaced');
  });

  it('starts at the chosen compartment or the next one with records', () => {
    expect(startIndex(items, order, 1, 1)).toBe(0);
    expect(startIndex(items, order, 1, 2)).toBe(2); // empty compartment 2 → compartment 3
    expect(startIndex(items, order, 1, 4)).toBe(3); // behind the last one → next shelf
    expect(startIndex(items, order, 2, 1)).toBe(3);
    expect(startIndex(items, order, 2, 2)).toBe(5); // only copies without place follow
    expect(startIndex([], order, 1, 1)).toBe(-1);
    expect(startIndex(items.slice(0, 3), order, 2, 1)).toBe(-1);
  });

  it('counts the position within the compartment', () => {
    expect(compartmentProgress(items, 0)).toEqual({ position: 1, total: 2 });
    expect(compartmentProgress(items, 1)).toEqual({ position: 2, total: 2 });
    expect(compartmentProgress(items, 2)).toEqual({ position: 1, total: 1 });
    expect(compartmentProgress(items, 4)).toEqual({ position: 2, total: 2 });
    expect(compartmentProgress(items, 5)).toEqual({ position: 1, total: 1 });
  });

  it('marks the first copy and every change of compartment or shelf', () => {
    expect(items.map((_, i) => isNewCompartment(items, i, 0))).toEqual([true, false, true, true, false, true]);
    expect(isNewCompartment(items, 1, 1)).toBe(true);
  });
});
