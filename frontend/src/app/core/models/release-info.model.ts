export type ChangeType = 'feat' | 'fix' | 'chore' | 'perf' | 'docs' | 'refactor' | 'security' | 'other';

export interface ReleaseItem {
  title: string;
  type: ChangeType;
  typeLabel?: string;
  summary?: string;
  details: string[];
}

export interface ReleaseEntry {
  version: string;
  rawHeader: string;
  date?: string;
  tag?: string;
  isCurrent: boolean;
  isUnreleased: boolean;
  items: ReleaseItem[];
}
