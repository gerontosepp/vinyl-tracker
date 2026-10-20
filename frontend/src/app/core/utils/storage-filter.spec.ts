import { parseStorageFilter, shelfOptions } from './storage-filter';
import { StorageLayout } from '../types';

describe('storage filter', () => {
  it('parses the encoded filter values', () => {
    expect(parseStorageFilter('')).toEqual({});
    expect(parseStorageFilter('unplaced')).toEqual({ storage_unit: 'unplaced' });
    expect(parseStorageFilter('7')).toEqual({ storage_unit: '7' });
    expect(parseStorageFilter('7:3')).toEqual({ storage_unit: '7', compartment: 3 });
  });

  it('lists the shelves of all media with their compartment count', () => {
    const compartment = (number: number) => ({
      number,
      row: 1,
      column: number,
      capacity: 70,
      used: 0,
      count: 0,
      firstArtist: null,
      lastArtist: null,
      oversized: false,
    });
    const layout: StorageLayout = {
      media: [
        {
          media: 'vinyl',
          unplacedCount: 0,
          units: [{ id: 1, name: 'Kallax-1', typeName: 'Kallax', rows: 1, columns: 2, compartments: [compartment(1), compartment(2)] }],
        },
        {
          media: 'cd',
          unplacedCount: 0,
          units: [{ id: 5, name: 'CD-1', typeName: 'CD', rows: 1, columns: 1, compartments: [compartment(1)] }],
        },
      ],
    };
    expect(shelfOptions(layout)).toEqual([
      { id: 1, name: 'Kallax-1', compartments: 2 },
      { id: 5, name: 'CD-1', compartments: 1 },
    ]);
  });
});
