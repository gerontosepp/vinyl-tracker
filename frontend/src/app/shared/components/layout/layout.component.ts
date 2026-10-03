import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { BottomNavComponent } from './bottom-nav/bottom-nav.component';
import { TopMenuBarComponent } from './top-menu-bar/top-menu-bar.component';
import { AuthService } from '../../../core/services/auth.service';
import { ScannerService } from '../../../core/services/scanner.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SidebarComponent, BottomNavComponent, TopMenuBarComponent],
  template: `
    <div
      class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors text-slate-900 dark:text-slate-50"
    >
      <!-- Top Global Menu Bar -->
      <app-top-menu-bar />

      <!-- Desktop Sidebar -->
      <app-sidebar (scanClick)="handleScan()" />

      <!-- Main Content Area -->
      <!-- pt-16 accounts for TopMenuBar, pb-24 accounts for BottomNav on mobile. Sidebar handles md margin-left. -->
      <main
        class="flex-1 w-full pt-16 pb-24 md:pb-0 md:ml-24 min-h-screen transition-all duration-300"
      >
        <div
          [class]="
            fullWidth()
              ? 'w-full p-3 sm:p-4 md:p-6'
              : 'max-w-7xl mx-auto p-4 sm:p-6 md:p-8 lg:p-10'
          "
        >
          <ng-content></ng-content>
        </div>
      </main>

      <!-- Mobile Bottom Nav -->
      <app-bottom-nav (scanClick)="handleScan()" />

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
  readonly fullWidth = input<boolean>(false);
  readonly authService = inject(AuthService);
  private readonly scannerService = inject(ScannerService);
  private readonly router = inject(Router);

  handleScan(): void {
    this.scannerService.openScanner();
    const currentUrl = this.router.url;
    // If not on dashboard, navigate to dashboard to show scanner
    if (currentUrl !== '/' && currentUrl !== '/#') {
      this.router.navigate(['/']);
    }
  }
}
