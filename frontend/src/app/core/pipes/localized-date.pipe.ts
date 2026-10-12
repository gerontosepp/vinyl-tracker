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
    const activeLocale = locale || this.languageService.language();
    return this.datePipe.transform(value, format, timezone, activeLocale);
  }
}
