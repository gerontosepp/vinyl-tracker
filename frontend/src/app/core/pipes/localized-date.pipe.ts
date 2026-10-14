import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'localizedDate',
  standalone: true,
  pure: false,
})
export class LocalizedDatePipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);
  private readonly datePipe = new DatePipe('en');

  transform(
    value: Date | string | number | null | undefined,
    format: string = 'mediumDate',
    timezone?: string,
    locale?: string
  ): string | null {
    if (value == null || value === '') return null;
    let dateVal: Date | string | number = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
        dateVal = trimmed + 'Z';
      }
    }
    const activeLocale = locale || this.languageService.language();
    return this.datePipe.transform(dateVal, format, timezone, activeLocale);
  }
}
