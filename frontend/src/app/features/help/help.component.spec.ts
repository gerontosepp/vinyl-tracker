import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { HelpComponent, HelpSection } from './help.component';
import { LanguageService } from '../../core/services/language.service';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import helpDe from '../../../../public/assets/help.de.json';
import helpEn from '../../../../public/assets/help.en.json';

const sections: HelpSection[] = [
  { id: 'scannen', title: 'Scannen', html: '<p>Barcode <strong>scannen</strong></p>', text: 'Barcode scannen' },
  { id: 'regale', title: 'Regale', html: '<p>Regale verwalten</p>', text: 'Regale verwalten und neu verteilen' },
];

describe('HelpComponent', () => {
  let fixture: ComponentFixture<HelpComponent>;
  let http: HttpTestingController;
  const fragment = new BehaviorSubject<string | null>(null);

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { fragment } },
      ],
    });
    TestBed.overrideComponent(HelpComponent, {
      remove: { imports: [LayoutComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    await TestBed.compileComponents();
    TestBed.inject(LanguageService).setLanguage('de');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HelpComponent);
    fixture.autoDetectChanges();
  });

  afterEach(() => http.verify());

  async function load(): Promise<void> {
    TestBed.tick();
    http.expectOne('/assets/help.de.json').flush({ sections });
    await fixture.whenStable();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const shown = () => Array.from(el().querySelectorAll('[data-testid="help-section"] h2')).map((h) => h.textContent?.trim());

  it('renders all sections with table of contents', async () => {
    await load();
    expect(shown()).toEqual(['Scannen', 'Regale']);
    expect(el().querySelector('#scannen strong')?.textContent).toBe('scannen');
    expect(el().querySelectorAll('[data-testid="help-toc"] a').length).toBe(2);
  });

  it('filters the sections by every search term', async () => {
    await load();
    const search = el().querySelector<HTMLInputElement>('[data-testid="help-search"]')!;
    search.value = 'neu verteilen';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(shown()).toEqual(['Regale']);

    // The table of contents lists only the matching sections
    expect(el().querySelectorAll('[data-testid="help-toc"] a').length).toBe(1);

    search.value = 'gibt es nicht';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el().querySelector('[data-testid="help-no-results"]')).not.toBeNull();
  });

  it('scrolls to the section of the link anchor', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      fragment.next('regale');
      await load();
      const target = el().querySelector<HTMLElement>('#regale')!;
      target.scrollIntoView = vi.fn();
      vi.runAllTimers();
      expect(target.scrollIntoView).toHaveBeenCalled();
    } finally {
      fragment.next(null);
      vi.useRealTimers();
    }
  });

  it('reports a failed load', async () => {
    TestBed.tick();
    http.expectOne('/assets/help.de.json').flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Die Hilfe konnte nicht geladen werden.');
  });
});

describe('help content (docs/Help.md → assets)', () => {
  // Anchors used by the context help (<app-help-link anchor="…">)
  const contextAnchors = ['scannen', 'label-foto', 'sammlung', 'manuell', 'regale', 'sortiermodus', 'einstellungen'];

  it('offers every context help anchor in both languages', () => {
    for (const help of [helpDe, helpEn]) {
      const ids = help.sections.map((s: HelpSection) => s.id);
      expect(ids).toEqual(expect.arrayContaining(contextAnchors));
    }
  });

  it('keeps Markdown markers out of the search text', () => {
    for (const help of [helpDe, helpEn]) {
      for (const section of help.sections as HelpSection[]) {
        expect(section.text).not.toMatch(/(^|\s)(#{2,}|-)\s/);
      }
    }
  });

  it('has the same sections in German and English', () => {
    expect(helpEn.sections.map((s: HelpSection) => s.id)).toEqual(helpDe.sections.map((s: HelpSection) => s.id));
  });
});
