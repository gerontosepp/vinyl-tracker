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
    const v061 = list.find((r) => r.version === 'v0.6.1');
    expect(v061).toBeDefined();
    expect(v061?.isCurrent).toBeTrue();
  });

  it('should return current release', () => {
    const current = service.currentRelease();
    expect(current).toBeDefined();
    expect(current?.version).toBe('v0.6.1');
  });

  it('should manage expanded versions', () => {
    expect(service.isExpanded('v0.6.1')).toBeTrue();

    // Toggle off
    service.toggleExpand('v0.6.1');
    expect(service.isExpanded('v0.6.1')).toBeFalse();

    // Toggle back on
    service.toggleExpand('v0.6.1');
    expect(service.isExpanded('v0.6.1')).toBeTrue();
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
    expect(filtered.some((r) => r.version === 'v0.5.0')).toBeTrue();
    // Search query should expand matching releases
    expect(service.isExpanded('v0.5.0')).toBeTrue();
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
