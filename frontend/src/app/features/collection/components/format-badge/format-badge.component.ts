import { Component, input, ChangeDetectionStrategy } from '@angular/core';

import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LucideDisc, LucideDiscAlbum } from '@lucide/angular';
import { FormatType } from '../../utils/format-type.util';

@Component({
  selector: 'app-format-badge',
  standalone: true,
  imports: [TranslatePipe, LucideDisc, LucideDiscAlbum],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './format-badge.component.html',
})
export class FormatBadgeComponent {
  readonly format = input<FormatType>('lp');
  readonly compact = input<boolean>(false);
}
