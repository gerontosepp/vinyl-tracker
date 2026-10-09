import { getFormatType } from './format-type.util';
import { CollectionRelease } from '../../../core/types';

describe('format-type.util', () => {
  it('should return cd when format string contains cd and qty is 1', () => {
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

  it('should return double_cd when format string indicates Double CD', () => {
    const release = {
      id: 2,
      instance_id: 2,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 2,
        title: 'Greatest Hits 2CD',
        year: 2005,
        thumb: '',
        cover_image: '',
        artists: [],
        format: 'Double CD',
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_cd');
  });

  it('should return double_cd when format string has 2xCD or 2CD', () => {
    const release = {
      id: 3,
      instance_id: 3,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 3,
        title: 'Live Anthology',
        year: 2010,
        thumb: '',
        cover_image: '',
        artists: [],
        format: '2xCD, Album',
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_cd');
  });

  it('should return double_cd when formats list has CD with qty >= 2', () => {
    const release = {
      id: 4,
      instance_id: 4,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 4,
        title: 'The Wall (Live)',
        year: 2000,
        thumb: '',
        cover_image: '',
        artists: [],
        formats: [{ name: 'CD', qty: '2', descriptions: ['Album'] }],
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_cd');
  });

  it('should return double_cd when formats list has CD with Double Album in descriptions', () => {
    const release = {
      id: 5,
      instance_id: 5,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 5,
        title: 'Deluxe Edition',
        year: 2012,
        thumb: '',
        cover_image: '',
        artists: [],
        formats: [{ name: 'CD', qty: '1', descriptions: ['Double Album'] }],
      },
    } as CollectionRelease;

    expect(getFormatType(release)).toBe('double_cd');
  });

  it('should return double_lp when format string indicates 2LP or Double LP', () => {
    const release = {
      id: 6,
      instance_id: 6,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 6,
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
      id: 7,
      instance_id: 7,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 7,
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
      id: 8,
      instance_id: 8,
      date_added: '',
      rating: 0,
      basic_information: {
        id: 8,
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
