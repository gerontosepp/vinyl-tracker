import { getFormatType } from './format-type.util';
import { CollectionRelease } from '../../../core/types';

describe('format-type.util', () => {
  it('should return cd when format string contains cd', () => {
    const release = {
      id: 1,
      instance_id: 1,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 1,
        title: 'CD Album',
        year: 2000,
        thumb: '',
        cover_image: '',
        artists: [],
        format: 'CD',
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('cd');
  });

  it('should return double_lp when format string indicates 2LP or Double LP', () => {
    const release = {
      id: 2,
      instance_id: 2,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 2,
        title: 'Gatefold 2LP',
        year: 1980,
        thumb: '',
        cover_image: '',
        artists: [],
        format: '2xLP, Album',
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_lp');
  });

  it('should return double_lp when formats list has qty >= 2 and vinyl', () => {
    const release = {
      id: 3,
      instance_id: 3,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 3,
        title: 'Double Vinyl',
        year: 1975,
        thumb: '',
        cover_image: '',
        artists: [],
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] }],
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_lp');
  });

  it('should return lp as default for standard vinyl', () => {
    const release = {
      id: 4,
      instance_id: 4,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 4,
        title: 'Single LP',
        year: 1969,
        thumb: '',
        cover_image: '',
        artists: [],
        format: 'LP',
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('lp');
  });

  it('should return lp if basic_information is missing', () => {
    const release = {} as CollectionRelease;
    expect(getFormatType(release)).toBe('lp');
  });
});
