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
