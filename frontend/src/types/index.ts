export interface User {
  id: number;
  username: string;
  discogsUsername?: string;
  token?: string;
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

export interface ScanResult {
  success: boolean;
  message: string;
  record?: TrackedRecord;
}

export interface SyncResult {
  added: number;
  removed: number;
}

export interface ResetResult {
  success: boolean;
  message: string;
  deletedCount: number;
}

export interface AnalyticsTopRecord {
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
}

export interface CollectionRelease {
  id: number;
  instance_id: number;
  date_added: string;
  rating: number;
  basic_information: DiscogsBasicInfo;
  listen_count?: number;
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

export interface QrCodeItem {
  id: number;
  title: string;
  artist: string;
}

export interface QrCodeRequest {
  items: QrCodeItem[];
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
