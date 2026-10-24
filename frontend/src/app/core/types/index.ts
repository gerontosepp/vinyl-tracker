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
  /** Placement hint for a newly added record (only when shelves exist for its medium). */
  placement?: StoragePlacement;
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

/** A most-played artist (`GET /api/analytics/top-artists`). */
export interface AnalyticsTopArtist {
  artist: string;
  count: number;
  /** Releases of the artist listened to in the period */
  recordCount: number;
  /** Covers of the most played releases (at most 4) */
  thumbUrls: string[];
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
  /** Custom sort string; null uses `default_sort_key`. */
  sort_key?: string | null;
  /** Automatic artist sort key (artist without a leading article). */
  default_sort_key?: string | null;
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
  storage?: StorageSlot;
  storage_neighbors?: StorageNeighbors;
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
  /** Custom sort string replacing the automatic artist sort key. */
  sort_key?: string;
  /** Computed shelf slot; absent when no shelf is configured for the medium. */
  storage?: StorageSlot;
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

export type PrintTemplate = 'avery-3474' | 'scan-list' | 'qr-cards' | 'inventory';

/** Same filters as `GET /api/collection` (snake_case, genres comma-separated). */
export interface PrintFilter {
  search?: string;
  category?: string;
  genres?: string;
  years?: string;
  not_played_since?: string;
  unplayed_only?: boolean;
  min_plays?: number;
  /** Shelf ID or `unplaced` */
  storage_unit?: string;
  compartment?: number;
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

// --- Shelf storage (#41) ---

export type StorageMedia = 'vinyl' | 'cd';

export interface StorageType {
  id: number;
  name: string;
  media: StorageMedia;
  rows: number;
  columns: number;
  /** Discs per compartment */
  capacity: number;
  unitCount: number;
}

export interface StorageTypeRequest {
  name: string;
  media?: StorageMedia;
  rows: number;
  columns: number;
  capacity: number;
}

export interface StorageTypesResult {
  types: StorageType[];
  /** Media that were redistributed because of the change */
  redistributed: StorageMedia[];
}

export interface StorageUnit {
  id: number;
  name: string;
  typeId: number;
  media: StorageMedia;
  sortOrder: number;
}

export interface StorageUnitsResult {
  units: StorageUnit[];
  redistributed: StorageMedia[];
}

export interface StorageSlot {
  unitId: number | null;
  unitName: string | null;
  compartment: number | null;
  row: number | null;
  column: number | null;
  oversized: boolean;
  unplaced: boolean;
}

export interface StorageRecordRef {
  discogsId: number;
  artist: string | null;
  title: string;
}

export interface StorageNeighbors {
  previous: StorageRecordRef | null;
  next: StorageRecordRef | null;
}

export interface StorageMove {
  record: StorageRecordRef;
  from: StorageSlot;
  to: StorageSlot;
}

export interface StoragePlacement {
  discogsId: number;
  slot: StorageSlot;
  neighbors: StorageNeighbors;
  moves: StorageMove[];
}

export interface StorageCompartment {
  number: number;
  row: number;
  column: number;
  capacity: number;
  used: number;
  count: number;
  firstArtist: string | null;
  lastArtist: string | null;
  oversized: boolean;
}

export interface StorageUnitLayout {
  id: number;
  name: string;
  typeName: string;
  rows: number;
  columns: number;
  compartments: StorageCompartment[];
}

export interface MediaLayout {
  media: StorageMedia;
  units: StorageUnitLayout[];
  unplacedCount: number;
}

export interface StorageLayout {
  media: MediaLayout[];
}

/** A copy in the sort mode sequence (`GET /api/storage/sequence`). */
export interface StorageSequenceItem {
  discogsId: number;
  instanceId: number;
  artist: string | null;
  title: string;
  thumbUrl: string | null;
  slot: StorageSlot;
}

/** All copies of a medium in shelf order, copies without a place last. */
export interface StorageSequence {
  media: StorageMedia;
  items: StorageSequenceItem[];
}

/** A shelf offered by the collection's storage filter. */
export interface StorageShelfOption {
  id: number;
  name: string;
  compartments: number;
}

export interface RedistributePreview {
  media: StorageMedia;
  movedCount: number;
}

/** Status of a label photo in the inbox (`/api/label-photos`). */
export type LabelPhotoStatus = 'pending' | 'identified' | 'failed';

/** State of the automatic identification via OpenRouter; absent when none was requested. */
export type LabelIdentifyState = 'queued' | 'running' | 'done' | 'error';

export type LabelMatchConfidence = 'high' | 'medium' | 'low';

/** A Discogs release proposed for a label photo. */
export interface LabelCandidate {
  discogsId: number;
  confidence: LabelMatchConfidence;
  reason: string;
  artist?: string | null;
  title?: string | null;
  year?: string | null;
  country?: string | null;
  label?: string | null;
  catno?: string | null;
  thumbUrl?: string | null;
  inCollection: boolean;
}

export interface LabelSuggestion {
  best: LabelCandidate;
  alternatives: LabelCandidate[];
  hint?: string | null;
}

/** A label photo waiting to be identified (automatically via OpenRouter or by Claude via MCP). */
export interface LabelPhoto {
  id: number;
  status: LabelPhotoStatus;
  discogsId: number | null;
  createdAt: string;
  processedAt: string | null;
  identifyState?: LabelIdentifyState;
  suggestion?: LabelSuggestion;
  identifyError?: string;
  identifyModel?: string;
}

/** OpenRouter settings for the automatic label identification; the key is never returned. */
export interface OpenRouterSettings {
  hasApiKey: boolean;
  model: string;
  defaultModel: string;
}

export interface LabelPhotosResult {
  photos: LabelPhoto[];
  pendingCount: number;
}

export interface LabelPhotoUploadResult {
  id: number;
  pendingCount: number;
  /** `true` when the photo is identified automatically. */
  identifying?: boolean;
}

export interface LabelPhotoDeleteResult {
  deleted: number;
  pendingCount: number;
}
