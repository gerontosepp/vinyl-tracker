import { toCollectionRelease } from './record-ref';

describe('toCollectionRelease', () => {
  it('builds the modal header data from a record reference', () => {
    const release = toCollectionRelease({
      discogsId: 101,
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      thumbUrl: 'https://i.discogs.com/kob.jpg',
    });

    expect(release.id).toBe(101);
    expect(release.basic_information).toEqual(
      expect.objectContaining({
        id: 101,
        title: 'Kind of Blue',
        artists: [{ name: 'Miles Davis' }],
        thumb: 'https://i.discogs.com/kob.jpg',
        year: 0,
      })
    );
  });

  it('handles a missing artist and cover', () => {
    const release = toCollectionRelease({ discogsId: 5, title: 'Untitled', thumbUrl: null });

    expect(release.basic_information.artists).toEqual([]);
    expect(release.basic_information.thumb).toBe('');
  });
});
