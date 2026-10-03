import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../core/pipes/translate.pipe';
import { CollectionRelease, QrCodeItem, RecordDetailDto } from '../../core/types';
import { getErrorMessage } from '../../core/utils/error';
import {
  LucideDownload,
  LucideExternalLink,
  LucideCheckSquare,
  LucideSquare,
  LucideArrowUp,
  LucideArrowDown,
  LucideSearch,
  LucideX,
} from '@lucide/angular';
import { Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LayoutComponent,
    TranslatePipe,
    LucideDownload,
    LucideExternalLink,
    LucideCheckSquare,
    LucideSquare,
    LucideArrowUp,
    LucideArrowDown,
    LucideSearch,
    LucideX,
  ],
  template: `
    <app-layout>
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-5rem)] transition-colors border border-slate-200/50 dark:border-slate-600"
      >
        <!-- Header / Actions -->
        <div
          class="p-5 md:p-6 border-b border-slate-100 dark:border-slate-600 flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {{ 'collection.title' | translate }}
          </h1>

          <div class="flex gap-3 w-full md:w-auto">
            <button
              (click)="handleDownloadSelected()"
              [disabled]="selectedCount() === 0 || generating()"
              [class]="
                'flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ' +
                (selectedCount() > 0
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md hover:-translate-y-0.5'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500 cursor-not-allowed')
              "
            >
              <svg lucideDownload [size]="18"></svg>
              {{ 'collection.selectedQr' | translate: { count: selectedCount() } }}
            </button>
            <button
              (click)="handleDownloadAll()"
              [disabled]="generating()"
              class="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <svg lucideDownload [size]="18"></svg>
              {{ 'collection.downloadQr' | translate }}
            </button>
          </div>
        </div>

        <!-- Controls & Pagination Top -->
        <div
          class="sticky top-0 z-20 p-4 md:px-6 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-xl flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 border-b border-slate-200/50 dark:border-slate-600 text-sm transition-colors shadow-sm"
        >
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <!-- Search Bar -->
            <div class="relative group w-full sm:w-64 order-1 sm:order-none shrink-0">
              <svg
                lucideSearch
                [size]="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors"
              ></svg>
              <input
                type="text"
                [placeholder]="'collection.searchPlaceholder' | translate"
                [ngModel]="search()"
                (ngModelChange)="onSearchChange($event)"
                class="pl-9 pr-8 py-1.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 backdrop-blur-sm"
              />
              @if (search()) {
                <button
                  (click)="clearSearch()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 cursor-pointer"
                >
                  <svg lucideX [size]="14"></svg>
                </button>
              }
            </div>

            <!-- Filter Buttons & Sort -->
            <div
              class="flex items-center gap-3 order-2 sm:order-none overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full sm:w-auto"
            >
              <button
                (click)="toggleSelectAllPage()"
                class="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium transition-colors shrink-0 cursor-pointer"
              >
                @if (isAllPageSelected()) {
                  <svg lucideCheckSquare class="text-indigo-600 dark:text-indigo-400" [size]="18"></svg>
                } @else {
                  <svg lucideSquare [size]="18"></svg>
                }
                <span class="whitespace-nowrap">Select Page</span>
              </button>

              <button
                (click)="toggleShowPlayedOnly()"
                [class]="
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 shrink-0 cursor-pointer ' +
                  (showPlayedOnly()
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm')
                "
              >
                <span class="font-semibold whitespace-nowrap">Played Only</span>
                @if (showPlayedOnly()) {
                  <span
                    class="text-[10px] font-bold bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded-full"
                    >ON</span
                  >
                }
              </button>

              <div class="h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mr-1 ml-1"></div>

              <!-- Sort Controls -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-slate-500 dark:text-slate-400 font-medium hidden sm:inline"
                  >Sort:</span
                >
                <select
                  [ngModel]="sort()"
                  (ngModelChange)="onSortChange($event)"
                  class="border border-slate-200 dark:border-slate-600 rounded-xl py-1.5 px-2.5 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <option value="artist">Band Name</option>
                  <option value="listens">Listens</option>
                </select>
                <button
                  (click)="toggleSortOrder()"
                  class="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm transition-colors cursor-pointer"
                  [title]="sortOrder() === 'asc' ? 'Ascending' : 'Descending'"
                >
                  @if (sortOrder() === 'asc') {
                    <svg lucideArrowUp [size]="16"></svg>
                  } @else {
                    <svg lucideArrowDown [size]="16"></svg>
                  }
                </button>
              </div>
            </div>
          </div>

          <div
            class="flex items-center justify-between xl:justify-end gap-4 w-full xl:w-auto shrink-0 order-3 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-200 dark:border-slate-600 mt-1 xl:mt-0"
          >
            @if (!loading() && loadStatus()) {
              <div
                class="hidden 2xl:inline-flex items-center gap-2 text-xs font-medium max-w-[18rem] truncate text-slate-500 dark:text-slate-400"
                role="status"
                aria-live="polite"
                [title]="'Discogs-Status: ' + loadStatus()"
              >
                <span
                  [class]="
                    'h-1.5 w-1.5 rounded-full shrink-0 ' +
                    (loadStatus().includes('Error')
                      ? 'bg-red-500 dark:bg-red-400'
                      : 'bg-emerald-500 dark:bg-emerald-400')
                  "
                ></span>
                <span class="truncate">Discogs: {{ loadStatus() }}</span>
              </div>
            }

            <select
              [ngModel]="perPage()"
              (ngModelChange)="onPerPageChange($event)"
              class="border border-slate-200 dark:border-slate-600 rounded-xl py-1.5 px-3 bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 shadow-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none backdrop-blur-sm cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all duration-200 hidden sm:block"
            >
              <option [value]="20">20 / page</option>
              <option [value]="30">30 / page</option>
              <option [value]="40">40 / page</option>
              <option [value]="50">50 / page</option>
              <option [value]="100">100 (Max)</option>
            </select>
            <span class="text-slate-500 dark:text-slate-400 font-medium">
              Page {{ page() }} of {{ totalPages() }}
            </span>
            <div class="flex gap-1">
              <button
                [disabled]="page() <= 1"
                (click)="prevPage()"
                class="p-1 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-700 bg-transparent text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
              >
                &lt;
              </button>
              <button
                [disabled]="page() >= totalPages()"
                (click)="nextPage()"
                class="p-1 px-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-700 bg-transparent text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        <!-- List Content -->
        <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/20 relative">
          @if (loading()) {
            <div
              class="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5 md:gap-8"
            >
              @for (item of [].constructor(perPage()); track $index) {
                <div
                  class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl p-4 flex flex-col gap-3 shadow-sm animate-pulse"
                >
                  <div class="w-full aspect-square bg-slate-200 dark:bg-slate-700/50 rounded-xl"></div>
                  <div class="flex-1 flex flex-col pt-1 gap-2">
                    <div class="h-4 bg-slate-200 dark:bg-slate-700/50 rounded-md w-3/4"></div>
                    <div class="h-3 bg-slate-200 dark:bg-slate-700/50 rounded-md w-1/2"></div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- --- DESKTOP DATA GRID --- -->
            <div
              class="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden"
            >
              <table class="w-full text-left border-collapse">
                <thead
                  class="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-600 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10 backdrop-blur-md"
                >
                  <tr>
                    <th class="px-4 py-4 w-12 text-center">
                      <button
                        (click)="toggleSelectAllPage()"
                        class="hover:text-indigo-500 transition-colors cursor-pointer"
                      >
                        @if (isAllPageSelected()) {
                          <svg lucideCheckSquare size="16" class="text-indigo-505 mx-auto"></svg>
                        } @else {
                          <svg lucideSquare size="16" class="mx-auto"></svg>
                        }
                      </button>
                    </th>
                    <th class="px-4 py-4 w-16">Cover</th>
                    <th class="px-4 py-4">Band Name</th>
                    <th class="px-4 py-4">Album Title</th>
                    <th class="px-4 py-4">Genre</th>
                    <th class="px-4 py-4">Year</th>
                    <th class="px-4 py-4">Wert</th>
                    <th class="px-4 py-4">Plays</th>
                    <th class="px-4 py-4 text-right">Link</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  @for (release of releases(); track release.id) {
                    <tr
                      (click)="toggleSelection(release)"
                      [class]="
                        'group transition-all duration-200 cursor-pointer ' +
                        (selectedItems().has(release.id)
                          ? 'bg-indigo-50/50 dark:bg-indigo-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30')
                      "
                    >
                      <td class="px-4 py-3 text-center">
                        @if (selectedItems().has(release.id)) {
                          <svg
                            lucideCheckSquare
                            class="text-indigo-500 dark:text-indigo-400 mx-auto"
                            [size]="18"
                          ></svg>
                        } @else {
                          <svg
                            lucideSquare
                            class="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 mx-auto transition-colors"
                            [size]="18"
                          ></svg>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <div
                          (click)="$event.stopPropagation(); openDetail(release)"
                          class="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-button cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                          title="Details anzeigen"
                        >
                          @if (release.basic_information.thumb) {
                            <img
                              [src]="
                                apiService.getProxiedImageUrl(release.basic_information.thumb)
                              "
                              alt=""
                              class="w-full h-full object-cover"
                            />
                          } @else {
                            <div class="w-full h-full flex items-center justify-center text-xs opacity-50">
                              💿
                            </div>
                          }
                        </div>
                      </td>
                      <td class="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {{ release.basic_information.artists.length > 0 ? release.basic_information.artists[0].name : 'Unknown' }}
                      </td>
                      <td
                        class="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[200px]"
                        [title]="release.basic_information.title"
                      >
                        <button
                          type="button"
                          (click)="$event.stopPropagation(); openDetail(release)"
                          class="text-left font-medium hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate max-w-full cursor-pointer focus:outline-none"
                        >
                          {{ release.basic_information.title }}
                        </button>
                      </td>
                      <td class="px-4 py-3">
                        @if (release.basic_information.genres && release.basic_information.genres.length > 0) {
                          <div class="flex flex-wrap gap-1 max-w-[200px]">
                            @for (genre of release.basic_information.genres.slice(0, 2); track genre) {
                              <span
                                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50"
                              >
                                {{ genre }}
                              </span>
                            }
                            @if (release.basic_information.genres.length > 2) {
                              <span
                                class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                [title]="release.basic_information.genres.slice(2).join(', ')"
                              >
                                +{{ release.basic_information.genres.length - 2 }}
                              </span>
                            }
                          </div>
                        } @else {
                          <span class="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                        {{ release.basic_information.year || '—' }}
                      </td>
                      <td class="px-4 py-3 text-sm">
                        @if (release.basic_information.lowest_price != null) {
                          <span class="font-medium text-emerald-600 dark:text-emerald-400">
                            {{ release.basic_information.lowest_price | currency:'EUR':'symbol':'1.2-2' }}
                          </span>
                        } @else {
                          <span class="text-slate-400 dark:text-slate-500">—</span>
                        }
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex items-center justify-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700"
                        >
                          {{ release.listen_count || 0 }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right">
                        <a
                          [href]="'https://www.discogs.com/release/' + release.id"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all inline-flex"
                          (click)="$event.stopPropagation()"
                        >
                          <svg lucideExternalLink [size]="16"></svg>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- --- MOBILE CARDS --- -->
            <div class="grid md:hidden grid-cols-2 gap-4 pb-4">
              @for (release of releases(); track release.id; let idx = $index) {
                <div
                  (click)="toggleSelection(release)"
                  [class]="
                    'relative group bg-white dark:bg-slate-800 border rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300 shadow-sm cursor-pointer animate-slide-up ' +
                    (selectedItems().has(release.id)
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-slate-200 dark:border-slate-600')
                  "
                  [style.animationDelay]="(idx % 12) * 50 + 'ms'"
                  style="opacity: 0"
                >
                  <div
                    class="absolute top-2 right-2 z-10 bg-slate-900/80 dark:bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md font-bold shadow-sm"
                  >
                    {{ release.listen_count || 0 }} plays
                  </div>

                  <div class="absolute top-2 left-2 z-10 transition-transform hover:scale-105">
                    @if (selectedItems().has(release.id)) {
                      <svg
                        lucideCheckSquare
                        class="text-indigo-500 dark:text-indigo-400 fill-white dark:fill-slate-900 drop-shadow-md"
                        [size]="20"
                      ></svg>
                    } @else {
                      <svg
                        lucideSquare
                        class="text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        [size]="20"
                      ></svg>
                    }
                  </div>

                  <div
                    (click)="$event.stopPropagation(); openDetail(release)"
                    class="w-full aspect-square bg-slate-100 dark:bg-slate-700/50 rounded-xl overflow-hidden relative shadow-inner cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                    title="Details anzeigen"
                  >
                    @if (release.basic_information.thumb) {
                      <img
                        [src]="apiService.getProxiedImageUrl(release.basic_information.thumb)"
                        alt="cover"
                        class="w-full h-full object-cover"
                      />
                    } @else {
                      <div
                        class="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium gap-1"
                      >
                        <span class="text-3xl opacity-50 grayscale">💿</span>
                      </div>
                    }
                  </div>

                  <div class="flex-1 min-w-0 flex flex-col pt-1">
                    <h3
                      (click)="$event.stopPropagation(); openDetail(release)"
                      class="font-bold text-slate-900 dark:text-slate-100 truncate text-sm leading-tight mb-0.5 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                      [title]="release.basic_information.title"
                    >
                      {{ release.basic_information.title }}
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                      {{ release.basic_information.artists.length > 0 ? release.basic_information.artists[0].name : 'Unknown' }} •
                      {{ release.basic_information.year || '—' }}
                    </p>
                    @if (release.basic_information.lowest_price != null) {
                      <div class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {{ release.basic_information.lowest_price | currency:'EUR':'symbol':'1.2-2' }}
                      </div>
                    }
                    @if (release.basic_information.genres && release.basic_information.genres.length > 0) {
                      <div class="flex flex-wrap gap-1 mt-1">
                        @for (genre of release.basic_information.genres.slice(0, 2); track genre) {
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40 truncate max-w-full"
                          >
                            {{ genre }}
                          </span>
                        }
                        @if (release.basic_information.genres.length > 2) {
                          <span
                            class="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            [title]="release.basic_information.genres.slice(2).join(', ')"
                          >
                            +{{ release.basic_information.genres.length - 2 }}
                          </span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }

          @if (!loading() && releases().length === 0) {
            <div
              class="flex flex-col items-center justify-center py-20 px-4 text-center mt-8 max-w-md mx-auto animate-fade-in"
            >
              <div
                class="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500 shadow-inner"
              >
                <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <h3 class="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                {{ search() ? 'No matches found' : 'Your collection is empty' }}
              </h3>
              <p class="text-base text-slate-500 dark:text-slate-400">
                {{
                  search()
                    ? "We couldn't find any records matching \\"" + search() + "\\". Try adjusting your filters."
                    : "It looks like you haven't synced your Discogs collection yet, or there are no records."
                }}
              </p>
            </div>
          }
        </div>
      </div>

      <!-- --- DETAIL MODAL --- -->
      @if (selectedRecord()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          (click)="closeDetail()"
        >
          <div
            class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
            (click)="$event.stopPropagation()"
          >
            <!-- Modal Header -->
            <div
              class="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-4"
            >
              <div class="flex items-center gap-4 min-w-0">
                <div
                  class="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-sm shrink-0"
                >
                  @if (selectedRecord()?.basic_information?.thumb) {
                    <img
                      [src]="
                        apiService.getProxiedImageUrl(
                          selectedRecord()!.basic_information.thumb
                        )
                      "
                      alt=""
                      class="w-full h-full object-cover"
                    />
                  } @else {
                    <div
                      class="w-full h-full flex items-center justify-center text-xl opacity-50"
                    >
                      💿
                    </div>
                  }
                </div>
                <div class="min-w-0">
                  <h2
                    class="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 truncate"
                  >
                    {{ selectedRecord()?.basic_information?.title }}
                  </h2>
                  <p
                    class="text-sm font-medium text-slate-600 dark:text-slate-400 truncate"
                  >
                    {{
                      selectedRecord()?.basic_information?.artists?.[0]?.name ||
                        'Unknown Artist'
                    }}
                    @if (selectedRecord()?.basic_information?.year) {
                      • {{ selectedRecord()?.basic_information?.year }}
                    }
                  </p>
                </div>
              </div>
              <button
                (click)="closeDetail()"
                class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Schließen"
              >
                <svg lucideX [size]="20"></svg>
              </button>
            </div>

            <!-- Modal Body (Scrollable) -->
            <div class="p-6 overflow-y-auto space-y-6 text-sm">
              @if (loadingDetail()) {
                <div
                  class="flex flex-col items-center justify-center py-12 gap-3 text-slate-400"
                >
                  <div
                    class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"
                  ></div>
                  <span>Lade Details aus Datenbank...</span>
                </div>
              } @else if (recordDetail()) {
                <!-- Key Stats Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50"
                  >
                    <div
                      class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Wert / Mindestpreis
                    </div>
                    <div
                      class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5"
                    >
                      {{
                        recordDetail()?.lowest_price != null
                          ? (recordDetail()?.lowest_price
                            | currency: 'EUR' : 'symbol' : '1.2-2')
                          : '—'
                      }}
                    </div>
                    @if (recordDetail()?.num_for_sale != null) {
                      <div class="text-[11px] text-slate-400">
                        {{ recordDetail()?.num_for_sale }} auf Discogs
                      </div>
                    }
                  </div>

                  <div
                    class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50"
                  >
                    <div
                      class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Plays
                    </div>
                    <div
                      class="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5"
                    >
                      {{ recordDetail()?.listen_count || 0 }}
                    </div>
                    <div class="text-[11px] text-slate-400">
                      {{
                        recordDetail()?.last_listened_at
                          ? (recordDetail()?.last_listened_at | date: 'shortDate')
                          : 'Nie'
                      }}
                    </div>
                  </div>

                  <div
                    class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50"
                  >
                    <div
                      class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Discogs ID
                    </div>
                    <div
                      class="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5"
                    >
                      #{{ recordDetail()?.discogs_id }}
                    </div>
                    <div class="text-[11px] text-slate-400">
                      DB ID: {{ recordDetail()?.id }}
                    </div>
                  </div>

                  <div
                    class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50"
                  >
                    <div
                      class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Hinzugefügt am
                    </div>
                    <div
                      class="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1"
                    >
                      {{
                        recordDetail()?.added_at
                          ? (recordDetail()?.added_at | date: 'mediumDate')
                          : '—'
                      }}
                    </div>
                    <div class="text-[11px] text-slate-400">
                      {{ recordDetail()?.country || 'Land unbekannt' }}
                    </div>
                  </div>
                </div>

                <!-- Details Section -->
                <div class="space-y-3">
                  <h3
                    class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    Metadaten
                  </h3>
                  <div
                    class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/40"
                  >
                    <div>
                      <span class="text-slate-400">Künstler:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.artist
                      }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-400">Album:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.title
                      }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-400">Erscheinungsjahr:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.year || '—'
                      }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-400">Veröffentlichung:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.released || '—'
                      }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-400">Land:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.country || '—'
                      }}</strong>
                    </div>
                    <div>
                      <span class="text-slate-400">Zuletzt gehört:</span>
                      <strong class="text-slate-700 dark:text-slate-200 ml-1">{{
                        recordDetail()?.last_listened_at
                          ? (recordDetail()?.last_listened_at | date: 'medium')
                          : 'Noch nie'
                      }}</strong>
                    </div>
                  </div>
                </div>

                <!-- Genres -->
                @if ((recordDetail()?.genres?.length || 0) > 0) {
                  <div class="space-y-2">
                    <h3
                      class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Genre
                    </h3>
                    <div class="flex flex-wrap gap-1.5">
                      @for (genre of recordDetail()?.genres; track genre) {
                        <span
                          class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50"
                        >
                          {{ genre }}
                        </span>
                      }
                    </div>
                  </div>
                }

                <!-- Formats & Labels -->
                @if (
                  (recordDetail()?.formats?.length || 0) > 0 ||
                  (recordDetail()?.labels?.length || 0) > 0
                ) {
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    @if ((recordDetail()?.formats?.length || 0) > 0) {
                      <div>
                        <h3
                          class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2"
                        >
                          Formate
                        </h3>
                        <div class="space-y-1">
                          @for (
                            fmt of recordDetail()?.formats;
                            track fmt.name
                          ) {
                            <div class="text-xs text-slate-700 dark:text-slate-300">
                              <span class="font-semibold"
                                >{{ fmt.qty }}x {{ fmt.name }}</span
                              >
                              @if (
                                fmt.descriptions &&
                                fmt.descriptions.length > 0
                              ) {
                                <span class="text-slate-400">
                                  ({{ fmt.descriptions.join(', ') }})</span
                                >
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                    @if ((recordDetail()?.labels?.length || 0) > 0) {
                      <div>
                        <h3
                          class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2"
                        >
                          Labels / Katalog-Nr.
                        </h3>
                        <div class="space-y-1">
                          @for (lbl of recordDetail()?.labels; track lbl.id) {
                            <div class="text-xs text-slate-700 dark:text-slate-300">
                              <span class="font-semibold">{{ lbl.name }}</span>
                              @if (lbl.catno) {
                                <span class="text-slate-400">
                                  • {{ lbl.catno }}</span
                                >
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- Tracklist -->
                @if ((recordDetail()?.tracklist?.length || 0) > 0) {
                  <div class="space-y-2">
                    <h3
                      class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Trackliste
                    </h3>
                    <div
                      class="divide-y divide-slate-100 dark:divide-slate-700/50 border border-slate-100 dark:border-slate-700/50 rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                    >
                      @for (
                        track of recordDetail()?.tracklist;
                        track $index
                      ) {
                        <div
                          class="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >
                          <div class="flex items-center gap-2 truncate">
                            <span
                              class="w-6 font-mono text-slate-400 shrink-0"
                              >{{ track.position || $index + 1 }}</span
                            >
                            <span
                              class="font-medium text-slate-700 dark:text-slate-200 truncate"
                              >{{ track.title }}</span
                            >
                          </div>
                          @if (track.duration) {
                            <span
                              class="text-slate-400 font-mono ml-2 shrink-0"
                              >{{ track.duration }}</span
                            >
                          }
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Listen History from DB -->
                @if ((recordDetail()?.listen_history?.length || 0) > 0) {
                  <div class="space-y-2">
                    <h3
                      class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Wiedergabeverlauf ({{
                        recordDetail()?.listen_history?.length
                      }})
                    </h3>
                    <div class="space-y-1 max-h-32 overflow-y-auto">
                      @for (
                        timestamp of recordDetail()?.listen_history;
                        track timestamp
                      ) {
                        <div
                          class="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2"
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full bg-indigo-500"
                          ></span>
                          {{ timestamp | date: 'medium' }}
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Notes -->
                @if (recordDetail()?.notes) {
                  <div class="space-y-1">
                    <h3
                      class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      Notizen
                    </h3>
                    <p
                      class="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/30"
                    >
                      {{ recordDetail()?.notes }}
                    </p>
                  </div>
                }
              }
            </div>

            <!-- Modal Footer -->
            <div
              class="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between"
            >
              <a
                [href]="
                  'https://www.discogs.com/release/' + selectedRecord()?.id
                "
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                <svg lucideExternalLink [size]="14"></svg>
                Auf Discogs öffnen
              </a>
              <button
                (click)="closeDetail()"
                class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      }
    </app-layout>
  `,
})
export class CollectionComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly apiService = inject(ApiService);
  readonly toastService = inject(ToastService);

  readonly selectedRecord = signal<CollectionRelease | null>(null);
  readonly recordDetail = signal<RecordDetailDto | null>(null);
  readonly loadingDetail = signal<boolean>(false);

  readonly page = signal<number>(1);
  readonly perPage = signal<number>(50);
  readonly totalPages = signal<number>(1);
  readonly releases = signal<CollectionRelease[]>([]);

  readonly loading = signal<boolean>(false);
  readonly generating = signal<boolean>(false);
  readonly search = signal<string>('');
  readonly debouncedSearch = signal<string>('');
  readonly loadStatus = signal<string>('');
  readonly showPlayedOnly = signal<boolean>(false);
  readonly sort = signal<string>('artist');
  readonly sortOrder = signal<string>('asc');

  readonly selectedItems = signal<Map<number, QrCodeItem>>(new Map());

  readonly isAllPageSelected = computed(() => {
    const rels = this.releases();
    const selected = this.selectedItems();
    return rels.length > 0 && rels.every((r) => selected.has(r.id));
  });

  readonly selectedCount = computed(() => this.selectedItems().size);

  private sub: Subscription | null = null;
  private searchTimer: any = null;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.sub) {
      this.sub.unsubscribe();
    }
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  loadData(): void {
    const user = this.authService.user();
    if (!user) return;

    if (this.sub) {
      this.sub.unsubscribe();
    }

    this.loading.set(true);
    const minPlays = this.showPlayedOnly() ? 1 : 0;

    this.sub = this.apiService
      .getCollection(
        this.page(),
        this.perPage(),
        minPlays,
        this.sort(),
        this.sortOrder(),
        this.debouncedSearch()
      )
      .subscribe({
        next: (data) => {
          this.releases.set(data.releases);
          const loadedTime = new Intl.DateTimeFormat('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date());

          if (data.pagination) {
            this.totalPages.set(data.pagination.pages);
            this.loadStatus.set(`${data.pagination.items} entries • ${loadedTime}`);
          } else {
            this.totalPages.set(1);
            this.loadStatus.set(`${data.releases.length} entries • ${loadedTime}`);
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.toastService.showToast(getErrorMessage(err, 'Failed to fetch collection'), 'error');
          this.loadStatus.set('Error loading');
          this.loading.set(false);
        },
      });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.debouncedSearch.set(value);
      this.page.set(1);
      this.loadData();
    }, 400);
  }

  clearSearch(): void {
    this.search.set('');
    this.debouncedSearch.set('');
    this.page.set(1);
    this.loadData();
  }

  toggleShowPlayedOnly(): void {
    this.showPlayedOnly.update((p) => !p);
    this.page.set(1);
    this.loadData();
  }

  onSortChange(value: string): void {
    this.sort.set(value);
    this.page.set(1);
    this.loadData();
  }

  toggleSortOrder(): void {
    this.sortOrder.update((so) => (so === 'asc' ? 'desc' : 'asc'));
    this.page.set(1);
    this.loadData();
  }

  onPerPageChange(value: any): void {
    this.perPage.set(Number(value));
    this.page.set(1);
    this.loadData();
  }

  prevPage(): void {
    this.page.update((p) => Math.max(1, p - 1));
    this.loadData();
  }

  nextPage(): void {
    this.page.update((p) => Math.min(this.totalPages(), p + 1));
    this.loadData();
  }

  toggleSelection(release: CollectionRelease): void {
    const id = release.id;
    this.selectedItems.update((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(id)) {
        newMap.delete(id);
      } else {
        const artist = release.basic_information.artists?.[0]?.name || 'Unknown Artist';
        newMap.set(id, {
          id: release.id,
          title: release.basic_information.title,
          artist,
        });
      }
      return newMap;
    });
  }

  toggleSelectAllPage(): void {
    const allSelected = this.isAllPageSelected();
    this.selectedItems.update((prev) => {
      const newMap = new Map(prev);
      if (allSelected) {
        this.releases().forEach((r) => newMap.delete(r.id));
      } else {
        this.releases().forEach((r) => {
          const artist = r.basic_information.artists?.[0]?.name || 'Unknown Artist';
          newMap.set(r.id, {
            id: r.id,
            title: r.basic_information.title,
            artist,
          });
        });
      }
      return newMap;
    });
  }

  async handleDownloadSelected(): Promise<void> {
    if (this.selectedCount() === 0) return;
    this.generating.set(true);
    try {
      const items = Array.from(this.selectedItems().values());
      const blob = await firstValueFrom(this.apiService.downloadQrCodesSelected(items));
      this.downloadBlob(blob, 'selected_qr_codes.pdf');
      this.toastService.showToast('QR codes generated successfully', 'success');
    } catch (err) {
      console.error(err);
      this.toastService.showToast(getErrorMessage(err, 'Failed to generate QR codes.'), 'error');
    } finally {
      this.generating.set(false);
    }
  }

  async handleDownloadAll(): Promise<void> {
    const user = this.authService.user();
    if (!user) return;
    if (
      !window.confirm('Generate QR codes for your ENTIRE collection? This may take a while.')
    ) {
      return;
    }

    this.generating.set(true);
    try {
      const blob = await firstValueFrom(this.apiService.downloadQrCodes());
      this.downloadBlob(blob, 'collection_qr_codes.pdf');
      this.toastService.showToast('QR codes generated successfully', 'success');
    } catch (err) {
      console.error(err);
      this.toastService.showToast(getErrorMessage(err, 'Failed to generate QR codes.'), 'error');
    } finally {
      this.generating.set(false);
    }
  }

  openDetail(release: CollectionRelease): void {
    this.selectedRecord.set(release);
    this.recordDetail.set(null);
    this.loadingDetail.set(true);

    this.apiService.getRecordDetails(release.id).subscribe({
      next: (detail) => {
        this.recordDetail.set(detail);
        this.loadingDetail.set(false);
        if (detail.lowest_price != null) {
          this.releases.update((list) =>
            list.map((r) =>
              r.id === release.id
                ? {
                    ...r,
                    basic_information: {
                      ...r.basic_information,
                      lowest_price: detail.lowest_price,
                      num_for_sale: detail.num_for_sale,
                    },
                  }
                : r
            )
          );
        }
      },
      error: (err) => {
        console.error(err);
        this.toastService.showToast(getErrorMessage(err, 'Fehler beim Laden der Details'), 'error');
        this.loadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.selectedRecord.set(null);
    this.recordDetail.set(null);
    this.loadingDetail.set(false);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
