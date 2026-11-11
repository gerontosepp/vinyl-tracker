import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideScanLine } from '@lucide/angular';
import { SidebarComponent } from './sidebar/sidebar.component';
import { BottomNavComponent } from './bottom-nav/bottom-nav.component';
import { TopMenuBarComponent } from './top-menu-bar/top-menu-bar.component';
import { CommandPaletteComponent } from './command-palette/command-palette.component';
import { AuthService } from '../../../core/services/auth.service';
import { NavigationUiService } from '../../../core/services/navigation-ui.service';
import { ScannerService } from '../../../core/services/scanner.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';

/**
 * App shell: fixed top bar, collapsible rail on desktop, bottom bar + scan button on phones.
 * Pages only provide content; the shell owns navigation, shortcuts (⌘K, ⌘B) and the palette.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    SidebarComponent,
    BottomNavComponent,
    TopMenuBarComponent,
    CommandPaletteComponent,
    LucideScanLine,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <div class="min-h-dvh bg-slate-50 dark:bg-slate-900 transition-colors text-slate-900 dark:text-slate-50">
      <!-- Top Global Menu Bar -->
      <app-top-menu-bar />

      <!-- Desktop Sidebar -->
      <app-sidebar (scanClick)="handleScan()" />

      <!-- Main Content Area -->
      <main class="min-h-dvh pt-16 pb-24 md:pb-0 transition-[padding] duration-200" [class]="mainPadding()">
        <div [class]="contentClass()">
          <ng-content></ng-content>
        </div>
      </main>

      <!-- Mobile Bottom Nav -->
      <app-bottom-nav />

      <!-- Scan is the primary action on phones, mirrored by the rail CTA on desktop -->
      <button
        type="button"
        (click)="handleScan()"
        data-testid="scan-fab"
        [attr.aria-label]="'nav.scan' | translate"
        [attr.aria-pressed]="scannerService.showScanner()"
        class="md:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+16px)] z-[52] flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-colors cursor-pointer"
      >
        <svg lucideScanLine [size]="24" [strokeWidth]="2.4"></svg>
      </button>

      <!-- Keyboard palette (⌘K) -->
      <app-command-palette (scan)="handleScan()" />

      <!-- Sync Global Toast Notification -->
      @if (authService.isSyncing()) {
        <div
          class="fixed bottom-[100px] md:bottom-8 right-4 md:right-8 left-4 md:left-auto p-4 rounded-xl shadow-lg border flex items-center space-x-3 z-50 text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100 max-w-full md:max-w-md bg-white/90 dark:bg-slate-800/90 backdrop-blur text-slate-800 dark:text-slate-200 border-slate-100 dark:border-slate-700"
        >
          <div
            class="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"
          ></div>
          <span>Syncing Discogs Collection...</span>
        </div>
      }
    </div>
  `,
})
export class LayoutComponent {
  /** `wide` uses the full workspace width, `narrow` suits reading pages like help and settings. */
  readonly width = input<'wide' | 'narrow'>('wide');

  readonly authService = inject(AuthService);
  readonly scannerService = inject(ScannerService);
  readonly ui = inject(NavigationUiService);
  private readonly router = inject(Router);

  readonly mainPadding = computed(() =>
    this.ui.railExpanded() ? 'md:pl-[232px]' : 'md:pl-[88px]',
  );

  readonly contentClass = computed(() =>
    this.width() === 'narrow'
      ? 'mx-auto w-full max-w-4xl p-4 sm:p-6 md:p-8'
      : 'mx-auto w-full max-w-[1560px] p-4 sm:p-6 md:p-8',
  );

  handleScan(): void {
    if (this.scannerService.showScanner()) {
      this.scannerService.closeScanner();
    } else {
      this.scannerService.openScanner();
      const currentUrl = this.router.url;
      // If not on dashboard, navigate to dashboard to show scanner
      if (currentUrl !== '/' && currentUrl !== '/#') {
        this.router.navigate(['/']);
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.ui.closePalette();
      this.ui.closeMore();
      return;
    }

    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'k':
        event.preventDefault();
        this.ui.togglePalette();
        break;
      case 'b':
        event.preventDefault();
        this.ui.toggleRail();
        break;
    }
  }
}
