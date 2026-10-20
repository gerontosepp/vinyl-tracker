import { StorageSequenceItem, StorageSlot } from '../../core/types';

/** Identifies a compartment (or "without place") so consecutive copies can be grouped. */
export function slotKey(slot: StorageSlot): string {
  return slot.unplaced || slot.unitId == null ? 'unplaced' : `${slot.unitId}:${slot.compartment}`;
}

/**
 * First copy at or after the chosen compartment: same shelf with a compartment number ≥ the
 * chosen one, else a later shelf (`unitOrder` = shelf IDs in shelf order), else the copies without
 * place. `-1` if nothing follows.
 */
export function startIndex(
  items: StorageSequenceItem[],
  unitOrder: number[],
  unitId: number,
  compartment: number
): number {
  const target = unitOrder.indexOf(unitId);
  return items.findIndex(({ slot }) => {
    if (slot.unplaced || slot.unitId == null) return true;
    const shelf = unitOrder.indexOf(slot.unitId);
    return shelf > target || (shelf === target && (slot.compartment ?? 0) >= compartment);
  });
}

/** Position (1-based) of the copy within its compartment and the number of copies there. */
export function compartmentProgress(items: StorageSequenceItem[], index: number): { position: number; total: number } {
  const key = slotKey(items[index].slot);
  let first = index;
  while (first > 0 && slotKey(items[first - 1].slot) === key) first--;
  let last = index;
  while (last < items.length - 1 && slotKey(items[last + 1].slot) === key) last++;
  return { position: index - first + 1, total: last - first + 1 };
}

/** The copy starts a compartment of this session (first copy or a different compartment). */
export function isNewCompartment(items: StorageSequenceItem[], index: number, start: number): boolean {
  return index === start || slotKey(items[index - 1].slot) !== slotKey(items[index].slot);
}
