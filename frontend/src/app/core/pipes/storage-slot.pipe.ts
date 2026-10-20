import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { StorageSlot } from '../types';

/** Formats a computed shelf slot, e.g. "Kallax-1 · Fach 3" (or "Kallax-1 · 3" when short). */
@Pipe({
  name: 'storageSlot',
  standalone: true,
  pure: false,
})
export class StorageSlotPipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);

  transform(slot: StorageSlot | null | undefined, short = false): string {
    if (!slot) return '';
    if (slot.unplaced) return this.languageService.translate('storage.unplaced');
    return this.languageService.translate(short ? 'storage.slotShort' : 'storage.slot', {
      unit: slot.unitName ?? '',
      compartment: slot.compartment ?? '',
    });
  }
}
