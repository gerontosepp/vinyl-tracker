export interface User {
  id: number;
  username: string;
  discogsUsername?: string;
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

export interface AnalyticsTopRecord {
  recordTitle: string;
  count: number;
}
