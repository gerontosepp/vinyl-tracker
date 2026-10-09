import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LucideDisc, LucideDiscAlbum } from '@lucide/angular';
import { FormatType } from '../../utils/format-type.util';

@Component({
  selector: 'app-format-badge',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideDisc, LucideDiscAlbum],
  templateUrl: './format-badge.component.html',
})
export class FormatBadgeComponent {
  readonly format = input<FormatType>('lp');
  readonly compact = input<boolean>(false);
}
