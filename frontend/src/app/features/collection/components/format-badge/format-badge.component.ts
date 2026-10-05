import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { LucideDisc, LucideDiscAlbum } from '@lucide/angular';

@Component({
  selector: 'app-format-badge',
  standalone: true,
  imports: [CommonModule, TranslatePipe, LucideDisc, LucideDiscAlbum],
  templateUrl: './format-badge.component.html',
})
export class FormatBadgeComponent {
  readonly format = input<'cd' | 'double_lp' | 'lp'>('lp');
  readonly compact = input<boolean>(false);
}
