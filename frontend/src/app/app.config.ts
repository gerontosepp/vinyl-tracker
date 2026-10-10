import { ApplicationConfig, provideZoneChangeDetection, isDevMode, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { LanguageService } from './core/services/language.service';

registerLocaleData(localeDe);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: LOCALE_ID,
      useFactory: (languageService: LanguageService) => languageService.language(),
      deps: [LanguageService],
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

