import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePanelLeftClose, LucidePanelLeftOpen } from '@lucide/angular';
import { navItemsFor } from '../../../../core/navigation';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';

/**
 * Desktop rail. Collapsed it shows icons only, expanded (⌘B) it adds labels. Both widths and the
 * items come from shared state, so the layout can pad the content area accordingly.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    NavIconComponent,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <aside
      class="hidden md:flex flex-col fixed left-0 top-16 bottom-0 z-20 py-4 overflow-hidden border-r border-slate-200/50 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] transition-[width] duration-200"
      [class.w-[88px]]="!ui.railExpanded()"
      [class.w-[232px]]="ui.railExpanded()"
      [attr.data-expanded]="ui.railExpanded()"
      aria-label="Navigation"
    >
      <nav class="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        @for (item of items(); track item.testId) {
          @if (item.pinned) {
            <div
              class="mt-auto pt-2 border-t border-slate-200/50 dark:border-slate-700/60"
              aria-hidden="true"
            ></div>
          }
          @if (item.action) {
            <button
              type="button"
              (click)="scanClick.emit()"
              [attr.data-testid]="item.testId"
              [attr.aria-label]="item.labelKey | translate"
              [attr.aria-pressed]="item.active"
              [attr.title]="ui.railExpanded() ? null : (item.labelKey | translate)"
              [class]="itemClass(item.active)"
            >
              <app-nav-icon
                [name]="item.icon"
                [size]="22"
                [strokeWidth]="item.active ? 2.5 : 2"
              />
              @if (ui.railExpanded()) {
                <span class="text-sm truncate">{{ item.labelKey | translate }}</span>
              }
            </button>
          } @else {
            <a
              [routerLink]="item.path"
              [queryParams]="item.queryParams ?? {}"
              (click)="scannerService.closeScanner()"
              [attr.data-testid]="item.testId"
              [attr.aria-current]="item.active ? 'page' : null"
              [attr.title]="ui.railExpanded() ? null : (item.labelKey | translate)"
              [class]="itemClass(item.active)"
            >
              <app-nav-icon
                [name]="item.icon"
                [size]="22"
                [strokeWidth]="item.active ? 2.5 : 2"
              />
              @if (ui.railExpanded()) {
                <span class="text-sm truncate">{{ item.labelKey | translate }}</span>
              }
            </a>
          }
        }
      </nav>

      <div class="mt-2 px-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/60">
        <button
          type="button"
          (click)="ui.toggleRail()"
          data-testid="rail-toggle"
          [attr.aria-label]="(ui.railExpanded() ? 'nav.collapseRail' : 'nav.expandRail') | translate"
          [attr.aria-expanded]="ui.railExpanded()"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          [class.justify-center]="!ui.railExpanded()"
        >
          @if (ui.railExpanded()) {
            <svg lucidePanelLeftClose [size]="20"></svg>
            <span class="truncate">{{ 'nav.collapseRail' | translate }}</span>
          } @else {
            <svg lucidePanelLeftOpen [size]="20"></svg>
          }
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly scanClick = output<void>();

  readonly scannerService = inject(ScannerService);
  readonly ui = inject(NavigationUiService);

  readonly items = computed(() =>
    navItemsFor('rail').map((item) => ({
      ...item,
      active: item.action ? this.scannerService.showScanner() : this.ui.isActive(item.testId),
    })),
  );

  itemClass(active: boolean): string {
    const base =
      'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer ';
    const state = active
      ? 'bg-indigo-50/60 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 font-medium';
    const alignment = this.ui.railExpanded() ? '' : 'justify-center';
    return `${base}${alignment} ${state}`;
  }
}
