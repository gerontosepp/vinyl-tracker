import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideLogOut } from '@lucide/angular';
import { navItemsFor } from '../../../../core/navigation';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { AuthService } from '../../../../core/services/auth.service';
import { NavigationUiService } from '../../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../../core/services/scanner.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';

/**
 * Mobile bar with the four primary destinations. Everything else lives in the "Mehr" sheet; scan is
 * the floating button above the bar. The centre slot stays empty on purpose so the FAB has room.
 */
@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NavIconComponent, LucideLogOut],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <nav
      class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center px-2 py-2 h-[80px] pb-safe bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] transition-colors"
      aria-label="Navigation"
    >
      @for (item of items(); track item.testId; let i = $index) {
        <a
          [routerLink]="item.path"
          [queryParams]="item.queryParams ?? {}"
          (click)="scannerService.closeScanner()"
          [attr.data-testid]="item.testId"
          [attr.aria-label]="item.labelKey | translate"
          [attr.aria-current]="item.active ? 'page' : null"
          [class]="itemClass(item.active)"
        >
          <app-nav-icon
            [name]="item.icon"
            [size]="24"
            [strokeWidth]="item.active ? 2.6 : 2"
          />
          <span class="text-[10px] font-bold tracking-wide">{{ item.labelKey | translate }}</span>
        </a>

        <!-- Free space for the scan button -->
        @if (i === 1) {
          <span class="w-16 shrink-0" aria-hidden="true"></span>
        }
      }

      <button
        type="button"
        (click)="ui.toggleMore()"
        data-testid="nav-more"
        [attr.aria-label]="'nav.more' | translate"
        [attr.aria-expanded]="ui.moreOpen()"
        [class]="itemClass(false)"
      >
        <app-nav-icon name="more" [size]="24" />
        <span class="text-[10px] font-bold tracking-wide">{{ 'nav.more' | translate }}</span>
      </button>
    </nav>

    @if (ui.moreOpen()) {
      <div
        class="md:hidden fixed inset-0 z-[55] bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
        (click)="ui.closeMore()"
      >
        <div
          class="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-slate-800 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="'nav.more' | translate"
          (click)="$event.stopPropagation()"
        >
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          <nav class="flex flex-col gap-0.5">
            @for (item of moreItems(); track item.testId) {
              <a
                [routerLink]="item.path"
                [queryParams]="item.queryParams ?? {}"
                (click)="navigateAway()"
                [attr.data-testid]="item.testId"
                [class]="sheetItemClass(item.active)"
              >
                <app-nav-icon [name]="item.icon" [size]="20" />
                <span class="text-sm">{{ item.labelKey | translate }}</span>
              </a>
            }

            <button
              type="button"
              (click)="logout()"
              data-testid="nav-logout"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <svg lucideLogOut [size]="20"></svg>
              <span>{{ 'nav.logout' | translate }}</span>
            </button>
          </nav>
        </div>
      </div>
    }
  `,
})
export class BottomNavComponent {
  readonly scannerService = inject(ScannerService);
  readonly ui = inject(NavigationUiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly items = computed(() =>
    navItemsFor('bottom').map((item) => ({ ...item, active: this.ui.isActive(item.testId) })),
  );

  readonly moreItems = computed(() =>
    navItemsFor('more').map((item) => ({ ...item, active: this.ui.isActive(item.testId) })),
  );

  itemClass(active: boolean): string {
    return (
      'flex flex-col items-center gap-1 min-w-12 px-2 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ' +
      (active
        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300')
    );
  }

  sheetItemClass(active: boolean): string {
    return (
      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors cursor-pointer ' +
      (active
        ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-600 dark:text-indigo-300'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50')
    );
  }

  navigateAway(): void {
    this.scannerService.closeScanner();
    this.ui.closeMore();
  }

  logout(): void {
    this.ui.closeMore();
    void this.authService.logout().then(() => this.router.navigate(['/login']));
  }
}
