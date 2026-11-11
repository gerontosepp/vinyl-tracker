import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Params, Router } from '@angular/router';
import type { NavIcon } from '../../../../core/navigation';
import { NAV_ITEMS } from '../../../../core/navigation';
import { LanguageService } from '../../../../core/services/language.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { NavIconComponent } from '../nav-icon/nav-icon.component';

type PaletteAction = 'scan' | 'language' | 'theme';

interface PaletteEntry {
  id: string;
  label: string;
  icon: NavIcon;
  path?: string;
  queryParams?: Params;
  action?: PaletteAction;
}

const MAX_RESULTS = 12;

/**
 * ⌘K palette: jumps to every destination of the app and offers the three global actions. It is
 * built from the same `NAV_ITEMS` as rail and bottom bar, so a new route only has to be added once.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [TranslatePipe, NavIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (ui.paletteOpen()) {
      <div
        class="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 pt-[12vh]"
        (click)="closeOnBackdrop($event)"
      >
        <div
          class="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="palette-title"
        >
          <h2 id="palette-title" class="sr-only">{{ 'palette.title' | translate }}</h2>

          <div class="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <svg
              class="text-slate-400 dark:text-slate-500 shrink-0"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              #searchInput
              type="text"
              [value]="query()"
              (input)="onQuery($event)"
              (keydown)="onKeydown($event)"
              [attr.placeholder]="'palette.placeholder' | translate"
              [attr.aria-label]="'palette.placeholder' | translate"
              aria-controls="palette-results"
              class="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <span
              class="hidden sm:inline-flex items-center rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400"
              >ESC</span
            >
          </div>

          <ul
            id="palette-results"
            role="listbox"
            class="max-h-[min(30rem,60vh)] overflow-y-auto p-1.5"
          >
            @for (entry of visible(); track entry.id; let i = $index) {
              <li role="option" [attr.aria-selected]="i === active()">
                <button
                  type="button"
                  (click)="choose(entry)"
                  (mouseenter)="active.set(i)"
                  [attr.data-testid]="'palette-' + entry.id"
                  [class]="
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer ' +
                    (i === active()
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50')
                  "
                >
                  <app-nav-icon [name]="entry.icon" [size]="18" />
                  <span class="truncate">{{ entry.label }}</span>
                  @if (i === active()) {
                    <span class="ml-auto text-xs font-bold opacity-60">↵</span>
                  }
                </button>
              </li>
            } @empty {
              <li class="px-3 py-6 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                {{ 'palette.empty' | translate }}
              </li>
            }
          </ul>

          <div
            class="flex items-center gap-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-2 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400"
          >
            <span>↑↓ {{ 'palette.hintNavigate' | translate }}</span>
            <span>↵ {{ 'palette.hintOpen' | translate }}</span>
            <span>ESC {{ 'palette.hintClose' | translate }}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  readonly scan = output<void>();

  protected readonly ui = inject(NavigationUiService);
  private readonly router = inject(Router);
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);
  private readonly scannerService = inject(ScannerService);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = signal('');
  readonly active = signal(0);

  /** Actions first, then every navigation destination. */
  private readonly entries = computed<PaletteEntry[]>(() => {
    // Recompute labels when the language changes.
    this.languageService.language();
    const t = (key: string) => this.languageService.translate(key);

    const actions: PaletteEntry[] = [
      { id: 'action-scan', label: t('palette.scan'), icon: 'scan', action: 'scan' },
      { id: 'action-language', label: t('palette.language'), icon: 'globe', action: 'language' },
      { id: 'action-theme', label: t('palette.theme'), icon: 'theme', action: 'theme' },
    ];

    const destinations: PaletteEntry[] = NAV_ITEMS.filter(
      (item) => !item.phoneOnly && !item.action,
    ).map((item) => ({
      id: item.testId ?? item.path,
      label: t(item.labelKey),
      icon: item.icon,
      path: item.path,
      queryParams: item.queryParams,
    }));

    return [...actions, ...destinations];
  });

  readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    const all = this.entries();
    const matches = term ? all.filter((entry) => entry.label.toLowerCase().includes(term)) : all;
    return matches.slice(0, MAX_RESULTS);
  });

  constructor() {
    // Reset and focus whenever the palette opens; clamp the highlight to the result list.
    effect(() => {
      if (this.ui.paletteOpen()) {
        this.query.set('');
        this.active.set(0);
        this.searchInput()?.nativeElement.focus();
      }
    });

    effect(() => {
      const count = this.visible().length;
      if (this.active() >= count) {
        this.active.set(0);
      }
    });
  }

  onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.visible().length;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.ui.closePalette();
        return;
      case 'ArrowDown':
        event.preventDefault();
        if (count) this.active.set((this.active() + 1) % count);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set((this.active() - 1 + count) % count);
        return;
      case 'Enter': {
        event.preventDefault();
        const entry = this.visible()[this.active()];
        if (entry) this.choose(entry);
        return;
      }
    }
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.ui.closePalette();
    }
  }

  choose(entry: PaletteEntry): void {
    this.ui.closePalette();

    switch (entry.action) {
      case 'scan':
        this.scan.emit();
        return;
      case 'language':
        this.languageService.setLanguage(this.languageService.language() === 'de' ? 'en' : 'de');
        return;
      case 'theme':
        this.themeService.toggle();
        return;
    }

    if (entry.path) {
      this.scannerService.closeScanner();
      void this.router.navigate([entry.path], { queryParams: entry.queryParams });
    }
  }
}
