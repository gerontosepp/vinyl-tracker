import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

/** Marks a manual record without a Discogs entry (#242). */
@Component({
  selector: 'app-manual-badge',
  standalone: true,
  imports: [TranslatePipe, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap"
      [appTooltip]="'manual.badgeTooltip' | translate"
      data-testid="manual-badge"
      >{{ 'manual.badge' | translate }}</span
    >
  `,
})
export class ManualBadgeComponent {}
