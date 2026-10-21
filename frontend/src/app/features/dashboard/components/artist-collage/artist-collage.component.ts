import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { ApiService } from '../../../../core/services/api.service';

/** Small cover collage of an artist: 1 cover fills it, 2 side by side, 3–4 as a 2×2 grid. */
@Component({
  selector: 'app-artist-collage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden shadow-xs border border-slate-200/60 dark:border-slate-700 grid gap-px"
      [class.grid-cols-2]="covers().length > 1"
      [class.grid-rows-2]="covers().length > 2"
      data-testid="artist-collage"
    >
      @for (url of covers(); track url) {
        <img [src]="url" [alt]="alt()" class="w-full h-full object-cover" loading="lazy" />
      } @empty {
        <div class="w-full h-full flex items-center justify-center text-[10px]" aria-hidden="true">🎤</div>
      }
    </div>
  `,
})
export class ArtistCollageComponent {
  private readonly api = inject(ApiService);

  readonly thumbUrls = input<string[]>([]);
  readonly alt = input<string>('');

  readonly covers = computed(() => this.thumbUrls().slice(0, 4).map((url) => this.api.getProxiedImageUrl(url)));
}
