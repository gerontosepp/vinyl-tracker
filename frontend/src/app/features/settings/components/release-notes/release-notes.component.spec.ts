import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReleaseNotesComponent } from './release-notes.component';
import { ReleaseInfoService } from '../../../../core/services/release-info.service';
import { LanguageService } from '../../../../core/services/language.service';
import { signal } from '@angular/core';

describe('ReleaseNotesComponent', () => {
  let component: ReleaseNotesComponent;
  let fixture: ComponentFixture<ReleaseNotesComponent>;
  let releaseInfoService: ReleaseInfoService;
  let mockLanguageService: any;

  beforeEach(async () => {
    mockLanguageService = {
      language: signal('de'),
      translate: (key: string) => key,
    };

    await TestBed.configureTestingModule({
      imports: [ReleaseNotesComponent],
      providers: [
        ReleaseInfoService,
        { provide: LanguageService, useValue: mockLanguageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReleaseNotesComponent);
    component = fixture.componentInstance;
    releaseInfoService = TestBed.inject(ReleaseInfoService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render section title and current release badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('h3');
    expect(title?.textContent).toContain('settings.changesTitle');

    const badge = el.querySelector('.bg-emerald-100');
    expect(badge?.textContent).toContain(releaseInfoService.currentRelease()?.version || 'v0.8.0');
  });

  it('should render inline markdown of release items as elements instead of raw markers', () => {
    releaseInfoService.releases.set([
      {
        version: 'v9.9.9',
        rawHeader: 'v9.9.9',
        isCurrent: true,
        isUnreleased: false,
        items: [
          {
            title: 'Tooling (`scripts/watch_pipeline.sh`)',
            type: 'feat',
            details: ['**Automatisierte CI-Überwachung**: via `gh run list` für *alle* Runs'],
          },
        ],
      },
    ]);
    releaseInfoService.expandAll();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const title = el.querySelector('h4');
    expect(title?.textContent?.trim()).toBe('Tooling (scripts/watch_pipeline.sh)');
    expect(title?.querySelector('code')?.textContent).toBe('scripts/watch_pipeline.sh');

    const detail = el.querySelector('li');
    expect(detail?.textContent?.trim()).toBe('Automatisierte CI-Überwachung: via gh run list für alle Runs');
    expect(detail?.querySelector('strong')?.textContent).toBe('Automatisierte CI-Überwachung');
    expect(detail?.querySelector('code')?.textContent).toBe('gh run list');
    expect(detail?.querySelector('em')?.textContent).toBe('alle');
    expect(detail?.textContent).not.toMatch(/[*`]/);
  });

  it('should render releases list', () => {
    const el: HTMLElement = fixture.nativeElement;
    const versionBadges = el.querySelectorAll('span.font-mono');
    expect(versionBadges.length).toBeGreaterThan(0);
  });

  it('should toggle accordion when release header is clicked', () => {
    const firstRelease = releaseInfoService.filteredReleases()[0];
    const isExpandedBefore = releaseInfoService.isExpanded(firstRelease.version);
    const el: HTMLElement = fixture.nativeElement;
    const firstButton = el.querySelector('button.w-full') as HTMLButtonElement;
    expect(firstButton).toBeTruthy();

    firstButton.click();
    fixture.detectChanges();

    expect(releaseInfoService.isExpanded(firstRelease.version)).toBe(!isExpandedBefore);
  });

  it('should handle expandAll and collapseAll', () => {
    component.releaseInfo.collapseAll();
    fixture.detectChanges();
    expect(component.releaseInfo.expandedVersions().size).toBe(0);

    component.releaseInfo.expandAll();
    fixture.detectChanges();
    expect(component.releaseInfo.expandedVersions().size).toBe(component.releaseInfo.releases().length);
  });

  it('should filter releases on search input', () => {
    component.releaseInfo.setSearchQuery('Eyoyo');
    fixture.detectChanges();

    const filtered = component.releaseInfo.filteredReleases();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((r) => r.version === 'v0.5.0')).toBe(true);
  });

  it('should return appropriate CSS classes for change types', () => {
    expect(component.getTypeBadgeClass('fix')).toContain('rose');
    expect(component.getTypeBadgeClass('feat')).toContain('indigo');
    expect(component.getTypeBadgeClass('chore')).toContain('amber');
    expect(component.getTypeBadgeClass('security')).toContain('purple');
    expect(component.getTypeBadgeClass('perf')).toContain('cyan');
    expect(component.getTypeBadgeClass('refactor')).toContain('emerald');
    expect(component.getTypeBadgeClass('docs')).toContain('blue');
    expect(component.getTypeBadgeClass('other')).toContain('slate');
  });
});
