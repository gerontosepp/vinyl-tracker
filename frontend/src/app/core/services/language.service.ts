import { Injectable, signal, effect, computed } from '@angular/core';

export type Language = 'de' | 'en';

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  de: {
    // Navigation & Layout
    'nav.home': 'Start',
    'nav.collection': 'Sammlung',
    'nav.stats': 'Statistiken',
    'nav.profile': 'Profil',
    'nav.scan': 'Scannen',
    'nav.settings': 'Einstellungen',
    'nav.totalRecords': 'Alben gesamt:',
    'nav.logout': 'Abmelden',
    'nav.syncing': 'Discogs-Sammlung wird synchronisiert...',

    // Settings
    'settings.title': 'Profil & Einstellungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.theme': 'Design-Modus',
    'settings.themeDesc': 'Aktiver Modus',
    'settings.language': 'Sprache / Language',
    'settings.languageDesc': 'Aktive Sprache',
    'settings.themeLight': 'Hell',
    'settings.themeDark': 'Dunkel',
    'settings.themeSystem': 'System',
    'settings.discogsTitle': 'Discogs Integration',
    'settings.discogsDesc': 'Verwalte deine Discogs API-Verbindung für Scans und Sammlungs-Sync.',
    'settings.username': 'Benutzername',
    'settings.newToken': 'Neues Token',
    'settings.tokenPlaceholder': 'Nur eingeben wenn geändert',
    'settings.currentPassword': 'Aktuelles Passwort',
    'settings.passwordPlaceholder': 'Erforderlich zum Verschlüsseln des Tokens',
    'settings.saveConnectivity': 'Verbindung Speichern',
    'settings.saving': 'Speichert...',
    'settings.roonTitle': 'Roon Integration',
    'settings.roonDesc': 'Verbinde deinen lokalen Roon Core zur direkten Steuerung und Album-Wiedergabe.',
    'settings.roonHost': 'Roon Core IP / Hostname',
    'settings.roonPort': 'Port',
    'settings.roonZone': 'Standard-Wiedergabezone',
    'settings.roonSelectZone': '-- Zone auswählen --',
    'settings.roonConnected': 'Verbunden',
    'settings.roonDisconnected': 'Nicht verbunden',
    'settings.roonPaired': 'Autorisiert',
    'settings.roonUnpaired': 'Warte auf Autorisierung (in Roon unter Einstellungen -> Erweiterungen freigeben)',
    'settings.roonSave': 'Roon-Einstellungen Speichern',
    'settings.roonRefreshZones': 'Zonen aktualisieren',
    'record.playOnRoon': 'Auf Roon abspielen',
    'record.playingOnRoon': 'Starte Roon...',
    'settings.dataManagement': 'Datenverwaltung',
    'settings.dataDesc': 'Manuelle Synchronisation oder Datenexport.',
    'settings.forceSync': 'Sammlung Synchronisieren',
    'settings.resetListens': 'Alle Hördurchgänge Zurücksetzen',
    'settings.exportCsv': 'Daten Exportieren (CSV)',
    'settings.resetConfirmTitle': 'Alle Hördurchgänge zurücksetzen?',
    'settings.resetConfirmText': 'Dies löscht dauerhaft deinen gesamten Hörverlauf. Diese Aktion kann nicht rückgängig gemacht werden.',
    'settings.cancel': 'Abbrechen',
    'settings.delete': 'Alle Löschen',
    'settings.deleting': 'Wird gelöscht...',

    // Dashboard
    'dashboard.all': 'Alle',
    'dashboard.today': 'Heute',
    'dashboard.scanTitle': 'Barcode / QR-Code scannen',
    'dashboard.scannedLabel': 'Gescannt:',
    'dashboard.listeningActivity': 'Hör-Aktivität',
    'dashboard.days7': '7 Tage',
    'dashboard.days30': '30 Tage',
    'dashboard.days90': '90 Tage',
    'dashboard.custom': 'Benutzerdefiniert',
    'dashboard.recentListens': 'Kürzlich Gehört',
    'dashboard.noListens': 'Noch keine Hördurchgänge erfasst.',
    'dashboard.collectionValue': 'Wert der Sammlung',
    'dashboard.estimatedValue': 'Geschätzter Gesamtwert basierend auf Discogs Preisen',
    'dashboard.genreBreakdown': 'Genre-Verteilung',
    'dashboard.records': 'Schallplatten',
    'dashboard.genres': 'Genres',

    // Collection
    'collection.title': 'Schallplattensammlung',
    'collection.searchPlaceholder': 'Sammlung durchsuchen...',
    'collection.sortBy': 'Sortieren nach:',
    'collection.sortTitle': 'Titel',
    'collection.sortArtist': 'Künstler',
    'collection.sortYear': 'Erscheinungsjahr',
    'collection.sortAdded': 'Hinzugefügt am',
    'collection.sortArtistYear': 'Künstler, Jahr (aufsteigend)',
    'collection.sortYearArtist': 'Jahr, Künstler',
    'collection.sortFormatArtistYear': 'Format, Künstler, Jahr',
    'collection.sortListensArtistYear': 'Listen, Künstler, Jahr',
    'collection.downloadQr': 'QR-Codes Herunterladen',
    'collection.selectedQr': 'Ausgewählte QR-Codes ({count})',
    'collection.noRecords': 'Keine Schallplatten gefunden.',
    'collection.tracks': 'Titel',
    'collection.listenHistory': 'Hörverlauf',
    'collection.addListen': 'Hördurchgang Hinzufügen',
    'collection.notes': 'Notizen',
    'collection.rating': 'Bewertung',
    'collection.thCover': 'Cover',
    'collection.thFormat': 'Format',
    'collection.formatLp': 'LP (Vinyl)',
    'collection.formatDoubleLp': 'Double LP (2xLP)',
    'collection.formatCd': 'CD (Compact Disc)',
    'collection.thArtist': 'Künstler / Band',
    'collection.thTitle': 'Albumtitel',
    'collection.thGenre': 'Genre',
    'collection.thYear': 'Jahr',
    'collection.thPlays': 'Plays',
    'collection.thLink': 'Link',
    'collection.selectPage': 'Seite auswählen',
    'collection.playedOnly': 'Nur Gespielte',
    'collection.sortListens': 'Hördurchgänge',
    'collection.pageOf': 'Seite {page} von {total}',
    'collection.perPage': '{count} / Seite',
    'collection.maxPerPage': '100 (Max)',

    // Statistics
    'stats.title': 'Statistiken & Einblicke',
    'stats.overview': 'Übersicht',
    'stats.totalListens': 'Gesamte Hördurchgänge',
    'stats.uniqueVinyls': 'Gespielte Vinyls',
    'stats.topPlayed': 'Meistgespielte Alben',
    'stats.topGenres': 'Top Genres',
    'stats.releaseDecades': 'Veröffentlichung nach Jahrzehnten',

    // General & Auth
    'auth.login': 'Anmelden',
    'auth.register': 'Registrieren',
    'auth.username': 'Benutzername',
    'auth.password': 'Passwort',
    'common.loading': 'Laden...',
    'common.success': 'Erfolgreich',
    'common.error': 'Fehler',
  },
  en: {
    // Navigation & Layout
    'nav.home': 'Home',
    'nav.collection': 'Collection',
    'nav.stats': 'Stats',
    'nav.profile': 'Profile',
    'nav.scan': 'Scan',
    'nav.settings': 'Settings',
    'nav.totalRecords': 'Total Records:',
    'nav.logout': 'Sign Out',
    'nav.syncing': 'Syncing Discogs Collection...',

    // Settings
    'settings.title': 'Profile & Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme Preference',
    'settings.themeDesc': 'Active mode',
    'settings.language': 'Language / Sprache',
    'settings.languageDesc': 'Active language',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.themeSystem': 'System',
    'settings.discogsTitle': 'Discogs Integration',
    'settings.discogsDesc': 'Manage your Discogs API connectivity for scanning and syncing your collection.',
    'settings.username': 'Username',
    'settings.newToken': 'New Token',
    'settings.tokenPlaceholder': 'Enter only if changing',
    'settings.currentPassword': 'Current Password',
    'settings.passwordPlaceholder': 'Required to encrypt token',
    'settings.saveConnectivity': 'Save Connectivity',
    'settings.saving': 'Saving...',
    'settings.roonTitle': 'Roon Integration',
    'settings.roonDesc': 'Connect your local Roon Core for direct playback and zone control.',
    'settings.roonHost': 'Roon Core IP / Hostname',
    'settings.roonPort': 'Port',
    'settings.roonZone': 'Default Playback Zone',
    'settings.roonSelectZone': '-- Select Zone --',
    'settings.roonConnected': 'Connected',
    'settings.roonDisconnected': 'Disconnected',
    'settings.roonPaired': 'Authorized',
    'settings.roonUnpaired': 'Waiting for authorization (enable under Roon Settings -> Extensions)',
    'settings.roonSave': 'Save Roon Settings',
    'settings.roonRefreshZones': 'Refresh Zones',
    'record.playOnRoon': 'Play on Roon',
    'record.playingOnRoon': 'Starting Roon...',
    'settings.dataManagement': 'Data Management',
    'settings.dataDesc': 'Sync your collection manually or export your data.',
    'settings.forceSync': 'Force Sync Collection',
    'settings.resetListens': 'Reset All Listens',
    'settings.exportCsv': 'Export Data (CSV)',
    'settings.resetConfirmTitle': 'Reset All Listening Events?',
    'settings.resetConfirmText': 'This will permanently delete all your listening history. This action cannot be undone.',
    'settings.cancel': 'Cancel',
    'settings.delete': 'Delete All',
    'settings.deleting': 'Resetting...',

    // Dashboard
    'dashboard.all': 'All',
    'dashboard.today': 'Today',
    'dashboard.scanTitle': 'Scan Barcode / QR Code',
    'dashboard.scannedLabel': 'Scanned:',
    'dashboard.listeningActivity': 'Listening Activity',
    'dashboard.days7': '7 Days',
    'dashboard.days30': '30 Days',
    'dashboard.days90': '90 Days',
    'dashboard.custom': 'Custom',
    'dashboard.recentListens': 'Recent Listens',
    'dashboard.noListens': 'No listening sessions recorded yet.',
    'dashboard.collectionValue': 'Collection Value',
    'dashboard.estimatedValue': 'Estimated total value based on Discogs marketplace pricing',
    'dashboard.genreBreakdown': 'Genre Breakdown',
    'dashboard.records': 'Records',
    'dashboard.genres': 'Genres',

    // Collection
    'collection.title': 'Vinyl Collection',
    'collection.searchPlaceholder': 'Search collection...',
    'collection.sortBy': 'Sort by:',
    'collection.sortTitle': 'Title',
    'collection.sortArtist': 'Artist',
    'collection.sortYear': 'Release Year',
    'collection.sortAdded': 'Date Added',
    'collection.sortArtistYear': 'Artist, Year (ascending)',
    'collection.sortYearArtist': 'Year, Artist',
    'collection.sortFormatArtistYear': 'Format, Artist, Year',
    'collection.sortListensArtistYear': 'Listens, Artist, Year',
    'collection.downloadQr': 'Download QR Codes',
    'collection.selectedQr': 'Selected QR Codes ({count})',
    'collection.noRecords': 'No records found.',
    'collection.tracks': 'Tracks',
    'collection.listenHistory': 'Listening History',
    'collection.addListen': 'Add Listen Event',
    'collection.notes': 'Notes',
    'collection.rating': 'Rating',
    'collection.thCover': 'Cover',
    'collection.thFormat': 'Format',
    'collection.formatLp': 'LP (Vinyl)',
    'collection.formatDoubleLp': 'Double LP (2xLP)',
    'collection.formatCd': 'CD (Compact Disc)',
    'collection.thArtist': 'Band / Artist',
    'collection.thTitle': 'Album Title',
    'collection.thGenre': 'Genre',
    'collection.thYear': 'Year',
    'collection.thPlays': 'Plays',
    'collection.thLink': 'Link',
    'collection.selectPage': 'Select Page',
    'collection.playedOnly': 'Played Only',
    'collection.sortListens': 'Listens',
    'collection.pageOf': 'Page {page} of {total}',
    'collection.perPage': '{count} / page',
    'collection.maxPerPage': '100 (Max)',

    // Statistics
    'stats.title': 'Statistics & Insights',
    'stats.overview': 'Overview',
    'stats.totalListens': 'Total Listening Sessions',
    'stats.uniqueVinyls': 'Played Vinyls',
    'stats.topPlayed': 'Most Played Albums',
    'stats.topGenres': 'Top Genres',
    'stats.releaseDecades': 'Releases by Decade',

    // General & Auth
    'auth.login': 'Sign In',
    'auth.register': 'Register',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
  },
};

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly language = signal<Language>(this.getInitialLanguage());

  readonly currentTranslations = computed(() => TRANSLATIONS[this.language()]);

  constructor() {
    effect(() => {
      const currentLang = this.language();
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', currentLang);
        document.documentElement.lang = currentLang;
      }
    });
  }

  setLanguage(lang: Language): void {
    this.language.set(lang);
  }

  translate(key: string, params?: Record<string, string | number>): string {
    const translation = this.currentTranslations()[key] || key;
    if (!params) return translation;

    let interpolated = translation;
    for (const [paramKey, value] of Object.entries(params)) {
      interpolated = interpolated.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
    }
    return interpolated;
  }

  private getInitialLanguage(): Language {
    if (typeof window === 'undefined') return 'de';

    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'de' || savedLanguage === 'en')) {
      return savedLanguage;
    }

    const browserLang = navigator.language || '';
    if (browserLang.toLowerCase().startsWith('en')) {
      return 'en';
    }

    return 'de';
  }
}
