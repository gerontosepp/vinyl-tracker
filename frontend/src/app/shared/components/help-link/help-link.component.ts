import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCircleQuestionMark } from '@lucide/angular';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { ScannerService } from '../../../core/services/scanner.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

/** Context help: a small ? icon that opens the help page at the section for the current page. */
@Component({
  selector: 'app-help-link',
  standalone: true,
  imports: [RouterLink, LucideCircleQuestionMark, TranslatePipe, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/help"
      [fragment]="anchor()"
      (click)="scannerService.closeScanner()"
      [appTooltip]="'help.contextTooltip' | translate"
      class="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      data-testid="help-link"
    >
      <svg lucideCircleQuestionMark [size]="18" aria-hidden="true"></svg>
    </a>
  `,
})
export class HelpLinkComponent {
  /** Anchor of the section in `docs/Help.md`. */
  readonly anchor = input.required<string>();
  readonly scannerService = inject(ScannerService);
}
