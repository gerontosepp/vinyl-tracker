import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideArrowDownUp,
  LucideBookmark,
  LucideCircleQuestionMark,
  LucideDisc,
  LucideGlobe,
  LucideHome,
  LucideInbox,
  LucideMoreHorizontal,
  LucideScanLine,
  LucideSettings,
  LucideSun,
} from '@lucide/angular';
import type { NavIcon } from '../../../../core/navigation';

/** Renders the icon of a navigation entry from the shared `NavIcon` key. */
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  imports: [
    LucideArrowDownUp,
    LucideBookmark,
    LucideCircleQuestionMark,
    LucideDisc,
    LucideGlobe,
    LucideHome,
    LucideInbox,
    LucideMoreHorizontal,
    LucideScanLine,
    LucideSettings,
    LucideSun,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @switch (name()) {
      @case ('home') {
        <svg lucideHome [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('disc') {
        <svg lucideDisc [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('bookmark') {
        <svg lucideBookmark [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('inbox') {
        <svg lucideInbox [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('settings') {
        <svg lucideSettings [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('help') {
        <svg lucideCircleQuestionMark [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('more') {
        <svg lucideMoreHorizontal [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('scan') {
        <svg lucideScanLine [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('globe') {
        <svg lucideGlobe [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('theme') {
        <svg lucideSun [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
      @case ('shelf') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          [attr.stroke-width]="strokeWidth()"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      }
      @case ('sort') {
        <svg lucideArrowDownUp [size]="size()" [strokeWidth]="strokeWidth()"></svg>
      }
    }
  `,
})
export class NavIconComponent {
  readonly name = input.required<NavIcon>();
  readonly size = input(22);
  readonly strokeWidth = input(2);
}
