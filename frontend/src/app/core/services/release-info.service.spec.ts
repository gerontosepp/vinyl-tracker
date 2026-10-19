import { TestBed } from '@angular/core/testing';
import { ReleaseInfoService } from './release-info.service';

describe('ReleaseInfoService', () => {
  let service: ReleaseInfoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReleaseInfoService]
    });
    service = TestBed.inject(ReleaseInfoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load initial releases', () => {
    const list = service.releases();
    expect(list.length).toBeGreaterThan(0);
    const current = list.find((r) => r.isCurrent);
    expect(current).toBeDefined();
    expect(current?.version).toMatch(/^v\d+\.\d+\.\d+/);
    const v080 = list.find((r) => r.version === 'v0.8.0');
    expect(v080).toBeDefined();
  });

  it('should return current release', () => {
    const current = service.currentRelease();
    expect(current).toBeDefined();
    expect(current?.version).toMatch(/^v\d+\.\d+\.\d+/);
    expect(current?.isCurrent).toBe(true);
  });

  it('should manage expanded versions', () => {
    const currentVersion = service.currentRelease()?.version || 'v0.9.0';
    expect(service.isExpanded(currentVersion)).toBe(true);

    // Toggle off
    service.toggleExpand(currentVersion);
    expect(service.isExpanded(currentVersion)).toBe(false);

    // Toggle back on
    service.toggleExpand(currentVersion);
    expect(service.isExpanded(currentVersion)).toBe(true);
  });

  it('should expand and collapse all releases', () => {
    service.expandAll();
    const count = service.releases().length;
    expect(service.expandedVersions().size).toBe(count);

    service.collapseAll();
    expect(service.expandedVersions().size).toBe(0);
  });

  it('should filter releases by search query and auto-expand', () => {
    service.setSearchQuery('Eyoyo');
    const filtered = service.filteredReleases();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((r) => r.version === 'v0.5.0')).toBe(true);
    // Search query should expand matching releases
    expect(service.isExpanded('v0.5.0')).toBe(true);
  });

  it('should return empty list when no matches are found', () => {
    service.setSearchQuery('XYZ_NON_EXISTENT_KEYWORD_12345');
    const filtered = service.filteredReleases();
    expect(filtered.length).toBe(0);
  });

  it('should filter by version number', () => {
    service.setSearchQuery('0.6.0');
    const filtered = service.filteredReleases();
    expect(filtered.length).toBe(1);
    expect(filtered[0].version).toBe('v0.6.0');
  });
});
