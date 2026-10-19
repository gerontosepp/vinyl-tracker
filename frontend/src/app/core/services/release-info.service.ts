import { Injectable, signal, computed } from '@angular/core';
import { ReleaseEntry } from '../models/release-info.model';
import { RELEASE_INFO_DATA } from '../constants/release-info.data';

@Injectable({
  providedIn: 'root'
})
export class ReleaseInfoService {
  readonly releases = signal<ReleaseEntry[]>(RELEASE_INFO_DATA);
  readonly searchQuery = signal<string>('');

  // Track expanded state by version string (default: current version expanded)
  readonly expandedVersions = signal<Set<string>>(
    new Set(
      RELEASE_INFO_DATA.filter((r) => r.isCurrent).map((r) => r.version)
    )
  );

  readonly currentRelease = computed(() =>
    this.releases().find((r) => r.isCurrent) ?? this.releases()[0]
  );

  readonly filteredReleases = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    // An empty "Unreleased" section (right after a release) is not worth showing
    const list = this.releases().filter((rel) => !rel.isUnreleased || rel.items.length > 0);
    if (!q) {
      return list;
    }

    return list
      .map((rel) => {
        const matchesVersion = rel.version.toLowerCase().includes(q) || (rel.tag && rel.tag.toLowerCase().includes(q));
        if (matchesVersion) {
          return rel;
        }

        const filteredItems = rel.items.filter((item) => {
          return (
            item.title.toLowerCase().includes(q) ||
            item.type.toLowerCase().includes(q) ||
            (item.typeLabel && item.typeLabel.toLowerCase().includes(q)) ||
            (item.summary && item.summary.toLowerCase().includes(q)) ||
            item.details.some((d) => d.toLowerCase().includes(q))
          );
        });

        if (filteredItems.length > 0) {
          return {
            ...rel,
            items: filteredItems
          };
        }
        return null;
      })
      .filter((r): r is ReleaseEntry => r !== null);
  });

  isExpanded(version: string): boolean {
    return this.expandedVersions().has(version);
  }

  toggleExpand(version: string): void {
    this.expandedVersions.update((set) => {
      const next = new Set(set);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  }

  expandAll(): void {
    const all = new Set(this.releases().map((r) => r.version));
    this.expandedVersions.set(all);
  }

  collapseAll(): void {
    this.expandedVersions.set(new Set());
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
    // If user searches, auto-expand all matching releases
    if (query.trim().length > 0) {
      this.expandAll();
    }
  }
}
