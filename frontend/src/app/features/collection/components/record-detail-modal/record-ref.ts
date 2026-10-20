import { CollectionRelease } from '../../../../core/types';

/** The few facts other views (e.g. the dashboard) know about a record before its details load. */
export interface RecordRef {
  discogsId: number;
  title: string;
  artist?: string;
  thumbUrl?: string | null;
}

/**
 * Builds the `record` input of the detail modal from a RecordRef: enough for its header; everything
 * else (instance, conditions, prices) comes from the loaded `RecordDetailDto`.
 */
export function toCollectionRelease(ref: RecordRef): CollectionRelease {
  return {
    id: ref.discogsId,
    instance_id: 0,
    date_added: '',
    rating: 0,
    basic_information: {
      id: ref.discogsId,
      title: ref.title,
      year: 0,
      thumb: ref.thumbUrl ?? '',
      cover_image: '',
      artists: ref.artist ? [{ name: ref.artist }] : [],
    },
  };
}
