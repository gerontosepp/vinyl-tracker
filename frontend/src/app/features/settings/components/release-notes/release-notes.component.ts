import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReleaseInfoService } from '../../../../core/services/release-info.service';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ChangeType, ReleaseEntry } from '../../../../core/models/release-info.model';
import {
  LucideHistory,
  LucideChevronDown,
  LucideChevronUp,
  LucideSearch,
  LucideCalendar
} from '@lucide/angular';

@Component({
  selector: 'app-release-notes',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    LucideHistory,
    LucideChevronDown,
    LucideChevronUp,
    LucideSearch,
    LucideCalendar
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-600 p-6 transition-colors space-y-6"
    >
      <!-- SECTION HEADER -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/50"
          >
            <svg lucideHistory [size]="20"></svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                {{ 'settings.changesTitle' | translate }}
              </h3>
              @if (releaseInfo.currentRelease(); as current) {
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {{ current.version }}
                </span>
              }
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {{ 'settings.changesDesc' | translate }}
            </p>
          </div>
        </div>

        <!-- EXPAND / COLLAPSE ALL BUTTONS -->
        <div class="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            (click)="releaseInfo.expandAll()"
            class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {{ 'settings.changesExpandAll' | translate }}
          </button>
          <button
            type="button"
            (click)="releaseInfo.collapseAll()"
            class="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {{ 'settings.changesCollapseAll' | translate }}
          </button>
        </div>
      </div>

      <!-- SEARCH FILTER -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <svg lucideSearch [size]="16"></svg>
        </div>
        <input
          type="text"
          [ngModel]="releaseInfo.searchQuery()"
          (ngModelChange)="releaseInfo.setSearchQuery($event)"
          [placeholder]="'settings.changesSearchPlaceholder' | translate"
          class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
        />
        @if (releaseInfo.searchQuery()) {
          <button
            type="button"
            (click)="releaseInfo.setSearchQuery('')"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        }
      </div>

      <!-- RELEASES ACCORDION LIST -->
      <div class="space-y-3">
        @for (release of releaseInfo.filteredReleases(); track release.version) {
          <div [class]="getReleaseCardClass(release)">
            <!-- ACCORDION HEADER BUTTON -->
            <button
              type="button"
              (click)="releaseInfo.toggleExpand(release.version)"
              class="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-colors cursor-pointer select-none"
            >
              <div class="flex flex-wrap items-center gap-2">
                <!-- Version Badge -->
                <span [class]="getVersionBadgeClass(release)">
                  {{ release.version }}
                </span>

                <!-- Status Badges -->
                @if (release.isCurrent) {
                  <span
                    class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                  >
                    ● {{ 'settings.changesCurrentBadge' | translate }}
                  </span>
                }

                @if (release.isUnreleased) {
                  <span
                    class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                  >
                    ✨ {{ 'settings.changesUnreleasedBadge' | translate }}
                  </span>
                }

                <!-- Date -->
                @if (release.date) {
                  <span
                    class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium"
                  >
                    <svg lucideCalendar [size]="12"></svg>
                    {{ release.date }}
                  </span>
                }

                <!-- Subtitle Tag -->
                @if (release.tag) {
                  <span
                    class="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block"
                  >
                    — {{ release.tag }}
                  </span>
                }
              </div>

              <!-- Right: Items Count & Chevron -->
              <div class="flex items-center gap-3 shrink-0">
                <span
                  class="text-xs font-semibold text-slate-400 dark:text-slate-500 hidden sm:inline"
                >
                  {{ release.items.length }} {{ 'settings.changesItemsCount' | translate }}
                </span>

                <div
                  class="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  @if (releaseInfo.isExpanded(release.version)) {
                    <svg lucideChevronUp [size]="16"></svg>
                  } @else {
                    <svg lucideChevronDown [size]="16"></svg>
                  }
                </div>
              </div>
            </button>

            <!-- ACCORDION CONTENT -->
            @if (releaseInfo.isExpanded(release.version)) {
              <div
                class="px-4 pb-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-4 animate-fade-in"
              >
                @if (release.tag) {
                  <p class="text-xs font-medium text-slate-500 dark:text-slate-400 sm:hidden">
                    {{ release.tag }}
                  </p>
                }

                <div class="space-y-3">
                  @for (item of release.items; track item.title) {
                    <div
                      class="p-3.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2 shadow-xs"
                    >
                      <!-- Item Header with Type Badge & Title -->
                      <div class="flex items-start gap-2.5">
                        <span
                          class="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 mt-0.5 uppercase tracking-wider"
                          [class]="getTypeBadgeClass(item.type)"
                        >
                          {{ item.typeLabel || item.type }}
                        </span>
                        <div class="flex-1">
                          <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                            {{ item.title }}
                          </h4>
                          @if (item.summary) {
                            <p class="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              {{ item.summary }}
                            </p>
                          }
                        </div>
                      </div>

                      <!-- Bulleted Details -->
                      @if (item.details.length > 0) {
                        <ul class="pl-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 list-disc marker:text-indigo-400 dark:marker:text-indigo-500">
                          @for (detail of item.details; track detail) {
                            <li class="leading-relaxed">
                              {{ detail }}
                            </li>
                          }
                        </ul>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <!-- Empty State -->
          <div
            class="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 space-y-2"
          >
            <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {{ 'settings.changesNoResults' | translate }}
            </p>
            <button
              type="button"
              (click)="releaseInfo.setSearchQuery('')"
              class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Filter zurücksetzen
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class ReleaseNotesComponent {
  readonly releaseInfo = inject(ReleaseInfoService);

  getReleaseCardClass(release: ReleaseEntry): string {
    const base = 'rounded-xl border transition-all overflow-hidden ';
    if (release.isCurrent) {
      return base + 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/20';
    }
    return base + 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60';
  }

  getVersionBadgeClass(release: ReleaseEntry): string {
    const base = 'font-mono font-extrabold text-sm px-2.5 py-0.5 rounded-lg border shadow-xs ';
    if (release.isCurrent) {
      return base + 'bg-indigo-600 text-white border-indigo-600';
    }
    return base + 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
  }

  getTypeBadgeClass(type: ChangeType): string {
    switch (type) {
      case 'fix':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300';
      case 'feat':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
      case 'chore':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      case 'security':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'perf':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300';
      case 'refactor':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
      case 'docs':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  }
}
