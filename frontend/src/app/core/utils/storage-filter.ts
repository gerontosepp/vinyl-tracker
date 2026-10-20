import { StorageLayout, StorageShelfOption } from '../types';

/**
 * Storage filter of the collection view, encoded as one string: `''` (none), `'unplaced'`,
 * `'<unitId>'` (whole shelf) or `'<unitId>:<compartment>'`.
 */
export function parseStorageFilter(value: string): { storage_unit?: string; compartment?: number } {
  if (!value) return {};
  if (value === 'unplaced') return { storage_unit: 'unplaced' };
  const [unit, compartment] = value.split(':');
  return compartment ? { storage_unit: unit, compartment: Number(compartment) } : { storage_unit: unit };
}

/** Shelves of all media in shelf order. */
export function shelfOptions(layout: StorageLayout): StorageShelfOption[] {
  return layout.media.flatMap((media) =>
    media.units.map((unit) => ({ id: unit.id, name: unit.name, compartments: unit.compartments.length }))
  );
}
