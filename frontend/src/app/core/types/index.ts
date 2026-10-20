export interface User {
  id: number;
  username: string;
  discogsUsername?: string;
  token?: string;
  roonHost?: string;
  roonPort?: number;
  roonZoneId?: string;
  roonZoneName?: string;
  roonPaired?: boolean;
}

export interface RoonStatus {
  connected: boolean;
  paired: boolean;
  coreName?: string;
  coreId?: string;
  host?: string;
  port?: number;
  selectedZoneId?: string;
  selectedZoneName?: string;
  zones: RoonZone[];
}

export interface RoonZone {
  zoneId: string;
  name: string;
  state: string;
}

export interface RoonSettings {
  roonHost?: string;
  roonPort?: number;
  roonZoneId?: string;
  roonZoneName?: string;
}

export interface RoonPlayRequest {
  artist: string;
  title: string;
  zoneId?: string;
}

export interface TrackedRecord {
  discogsId: number;
  title: string;
  artist: string;
  thumbUrl: string;
}

export interface ListenEvent {
  id: number;
  record: TrackedRecord;
  timestamp: string;
}

export interface DiscogsMatch {
  id: number;
  title: string;
  year?: string;
  thumbUrl?: string;
  coverImage?: string;
  format?: string[];
  country?: string;
}

export interface ScanResult {
  success: boolean;
  message: string;
  record?: TrackedRecord;
  discogsMatches?: DiscogsMatch[];
}

export interface SyncResult {
  added: number;
  removed: number;
}

/** Result of `POST /api/collection/restore` (merge of a JSON backup). */
export interface RestoreResult {
  format_version: number;
  records_total: number;
  records_added: number;
  records_updated: number;
  listens_added: number;
  listens_skipped: number;
  listen_history_included: boolean;
}

export interface ResetResult {
  success: boolean;
  message: string;
  deletedCount: number;
}

export interface AnalyticsTopRecord {
  /** Discogs release ID (0 from servers before v0.12) */
  discogsId?: number;
  recordTitle: string; // Keeping for backward compatibility if needed, though title is better
  title: string;
  artist: string;
  thumbUrl: string;
  count: number;
}

// Discogs Collection Types
export interface DiscogsArtist {
  name: string;
}

export interface DiscogsBasicInfo {
  id: number;
  title: string;
  year: number;
  thumb: string;
  cover_image: string;
  artists: DiscogsArtist[];
  genres?: string[];
  styles?: string[];
  lowest_price?: number;
  median_price?: number;
  num_for_sale?: number;
  format?: string;
  formats?: RecordFormat[];
}

export interface RecordTrack {
  position?: string;
  title?: string;
  duration?: string;
}

export interface RecordFormat {
  name?: string;
  qty?: string;
  descriptions?: string[];
  text?: string;
}

export interface RecordLabel {
  name?: string;
  catno?: string;
  id?: number;
  entity_type_name?: string;
}

export interface RecordDetailDto {
  id?: number;
  discogs_id: number;
  title?: string;
  artist?: string;
  year?: string;
  thumb_url?: string;
  genres: string[];
  in_collection: boolean;
  instance_id?: number;
  added_at?: string;
  media_condition?: string;
  sleeve_condition?: string;
  listen_count: number;
  last_listened_at?: string;
  lowest_price?: number;
  median_price?: number;
  num_for_sale?: number;
  listen_history?: string[];
  tracklist: RecordTrack[];
  format?: string;
  formats: RecordFormat[];
  labels: RecordLabel[];
  notes?: string;
  country?: string;
  released?: string;
}

export interface CollectionRelease {
  id: number;
  instance_id: number;
  date_added: string;
  rating: number;
  basic_information: DiscogsBasicInfo;
  listen_count?: number;
  last_played_at?: string;
  media_condition?: string;
  sleeve_condition?: string;
}

export interface CollectionPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    last?: string;
    next?: string;
  };
}

export interface CollectionResponse {
  releases: CollectionRelease[];
  pagination: CollectionPagination;
}

/** Record reference kept for the print selection in the collection view. */
export interface QrCodeItem {
  id: number;
  title: string;
  artist: string;
  /** CDs need an explicit confirmation before printing vinyl labels. */
  isCd?: boolean;
}

export type PrintTemplate = 'avery-3474' | 'scan-list' | 'qr-cards';

/** Same filters as `GET /api/collection` (snake_case, genres comma-separated). */
export interface PrintFilter {
  search?: string;
  category?: string;
  genres?: string;
  years?: string;
  not_played_since?: string;
  unplayed_only?: boolean;
  min_plays?: number;
  sort?: string;
  sort_order?: string;
}

export type PrintScope =
  | { type: 'all' }
  | { type: 'filter'; filter: PrintFilter }
  | { type: 'ids'; discogs_ids: number[] };

/** Body of `POST /api/print`. */
export interface PrintRequest {
  template: PrintTemplate;
  scope: PrintScope;
  options: {
    language: 'de' | 'en';
    start_position?: number;
  };
}

export interface CollectionValueData {
  currency: string;
  value: number;
}

export interface CollectionValueResponse {
  minimum: CollectionValueData;
  median: CollectionValueData;
  maximum: CollectionValueData;
}

export interface GenreBreakdownItem {
  name: string;
  value: number;
}

export interface PriceRefreshResult {
  updatedCount: number;
  totalCount: number;
  message: string;
}
