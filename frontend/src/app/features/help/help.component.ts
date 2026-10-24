import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  DOCUMENT,
} from '@angular/core';
import { httpResource } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { LanguageService } from '../../core/services/language.service';

/** One section of `docs/Help.md` / `docs/Help.en.md`, converted by `scripts/sync-help.js`. */
export interface HelpSection {
  id: string;
  title: string;
  /** Rendered from our own Markdown; Angular sanitizes it once more when binding. */
  html: string;
  /** Plain text for the search. */
  text: string;
}

/**
 * Help page: explains the features of the app, with a table of contents, a search that filters
 * the sections and anchors the context help (? icon) links to (`/help#anchor`).
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [LayoutComponent, TranslatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The section HTML is inserted via innerHTML, which emulated encapsulation does not reach
  encapsulation: ViewEncapsulation.None,
  styles: `
    .help-content p { margin: 0.5rem 0; }
    .help-content h3 { margin: 1rem 0 0.25rem; font-weight: 700; font-size: 0.95rem; }
    .help-content ul, .help-content ol { margin: 0.5rem 0; padding-left: 1.25rem; }
    .help-content ul { list-style: disc; }
    .help-content ol { list-style: decimal; }
    .help-content li { margin: 0.25rem 0; }
    .help-content code { font-size: 0.85em; padding: 0.1rem 0.3rem; border-radius: 0.25rem; background: rgb(127 127 127 / 0.15); }
    .help-content a { text-decoration: underline; font-weight: 600; }
    .help-content strong { font-weight: 700; }
  `,
  template: `
    <app-layout [fullWidth]="false">
      <div class="space-y-5">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ 'help.title' | translate }}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ 'help.intro' | translate }}</p>
          </div>
          <label class="w-full sm:w-72">
            <span class="sr-only">{{ 'help.search' | translate }}</span>
            <input
              #searchInput
              type="search"
              [value]="query()"
              (input)="query.set(searchInput.value)"
              [placeholder]="'help.search' | translate"
              data-testid="help-search"
              class="w-full text-sm rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        @if (help.error()) {
          <p class="text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ 'help.loadError' | translate }}</p>
        } @else if (help.hasValue()) {
          <div class="grid gap-6 lg:grid-cols-[14rem_1fr]">
            <nav class="lg:sticky lg:top-20 lg:self-start" [attr.aria-label]="'help.contents' | translate">
              <details class="lg:hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3" data-testid="help-toc-mobile">
                <summary class="text-sm font-semibold cursor-pointer">{{ 'help.contents' | translate }}</summary>
                <ul class="mt-2 space-y-1">
                  @for (section of visibleSections(); track section.id) {
                    <li>
                      <a
                        routerLink="/help"
                        [fragment]="section.id"
                        (click)="scrollTo(section.id)"
                        class="text-sm text-slate-600 dark:text-slate-300 hover:underline"
                        >{{ section.title }}</a
                      >
                    </li>
                  }
                </ul>
              </details>
              <ul class="hidden lg:block space-y-1 text-sm" data-testid="help-toc">
                @for (section of visibleSections(); track section.id) {
                  <li>
                    <a
                      routerLink="/help"
                      [fragment]="section.id"
                      (click)="scrollTo(section.id)"
                      class="block px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >{{ section.title }}</a
                    >
                  </li>
                }
              </ul>
            </nav>

            <div class="space-y-4 min-w-0">
              @for (section of visibleSections(); track section.id) {
                <section
                  [id]="section.id"
                  class="scroll-mt-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-sm text-slate-700 dark:text-slate-200"
                  data-testid="help-section"
                >
                  <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">{{ section.title }}</h2>
                  <div class="help-content" [innerHTML]="section.html"></div>
                </section>
              } @empty {
                <p class="text-sm text-slate-500 dark:text-slate-400" data-testid="help-no-results">{{ 'help.noResults' | translate }}</p>
              }
            </div>
          </div>
        } @else {
          <p class="text-sm text-slate-500">{{ 'help.loading' | translate }}</p>
        }
      </div>
    </app-layout>
  `,
})
export class HelpComponent {
  private readonly languageService = inject(LanguageService);
  private readonly document = inject(DOCUMENT);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);

  readonly help = httpResource<{ sections: HelpSection[] }>(() => `/assets/help.${this.languageService.language()}.json`);
  readonly sections = computed(() => (this.help.hasValue() ? this.help.value().sections : []));
  readonly query = signal('');
  /** Sections containing every search term in their title or text. */
  readonly visibleSections = computed(() => {
    const terms = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return this.sections();
    return this.sections().filter((section) => {
      const haystack = `${section.title} ${section.text}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  });

  /** Anchor already scrolled to, so reloading the help (language switch) keeps the position. */
  private scrolledTo: string | null = null;

  constructor() {
    // Jump to the section of a context help link once the help has been loaded and rendered
    effect(() => {
      const anchor = this.fragment();
      if (!anchor || anchor === this.scrolledTo || !this.sections().length) return;
      this.scrolledTo = anchor;
      setTimeout(() => this.scrollTo(anchor));
    });
  }

  /** Called on every TOC click, as the router ignores a navigation to the current fragment. */
  scrollTo(anchor: string): void {
    this.scrolledTo = anchor;
    this.document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
