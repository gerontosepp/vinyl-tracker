import { Component, input } from '@angular/core';

@Component({
  selector: 'app-statistic-widget',
  standalone: true,
  template: `
    <div
      [class]="
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 p-5 shadow-sm flex flex-col transition-colors h-full ' +
        className()
      "
    >
      <div class="mb-4">
        <h3
          class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1"
        >
          <span>{{ title() }}</span>
          @if (subtitle()) {
            <span class="text-xs text-slate-400 normal-case ml-2">{{ subtitle() }}</span>
          }
        </h3>
        @if (error() && !loading()) {
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">{{ error() }}</p>
        }
      </div>

      <div class="flex-1 min-h-0 relative">
        @if (loading()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 animate-spin"
            ></div>
          </div>
        } @else {
          <ng-content></ng-content>
        }
      </div>
    </div>
  `,
})
export class StatisticWidgetComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly className = input<string>('');
  readonly loading = input<boolean>(false);
  readonly error = input<string>();
}
