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
    'record.addedAt': 'Hinzugefügt am',
    'record.lastListened': 'Zuletzt gehört',
    'record.never': 'Nie',
    'record.notYet': 'Noch nie',
    'record.metadata': 'Metadaten',
    'record.country': 'Land',
    'record.unknownCountry': 'Land unbekannt',
    'record.notes': 'Notizen',
    'record.discogsId': 'Discogs ID',
    'record.dbId': 'DB ID',
    'record.releaseYear': 'Erscheinungsjahr',
    'record.release': 'Veröffentlichung',
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
    'settings.qrManagementTitle': 'QR-Code Verwaltung',
    'settings.qrManagementDesc': 'Generiere und lade eine druckbare PDF mit QR-Codes für deine gesamte Discogs-Sammlung herunter.',
    'settings.downloadQr': 'QR-Codes Herunterladen (PDF)',
    'settings.generatingQr': 'QR-Codes werden generiert...',

    // Scanner Settings
    'settings.scannerTitle': 'Barcode & QR Scanner',
    'settings.scannerDesc': 'Konfiguriere den externen Eyoyo EY-009P Hardware-Scanner (HID) oder den Kamera-Scanner.',
    'settings.scannerMode': 'Aktiver Scanner-Modus',
    'settings.scannerModeHardware': 'Externer Hardware-Scanner (Eyoyo EY-009P / HID)',
    'settings.scannerModeCamera': 'Interner Kamera-Scanner (Webcam / Smartphone)',
    'settings.scannerModeHybrid': 'Hybrid-Modus (Kamera & Hardware gleichzeitig)',
    'settings.scannerModeDesc': 'Im Hardware-Modus bleibt die Kamera aus, was Akku und Prozessorleistung spart.',
    'settings.scannerSound': 'Akustisches Feedback (Beep)',
    'settings.scannerSoundDesc': 'Spielt einen kurzen Bestätigungston bei jedem erfassten Scan ab.',
    'settings.scannerTestTitle': 'Scanner Live-Test',
    'settings.scannerTestDesc': 'Scanne jetzt einen Barcode oder QR-Code mit deinem Eyoyo Scanner, um die Erkennung zu prüfen.',
    'settings.scannerTestWaiting': 'Bereit... Scanne jetzt mit dem Eyoyo EY-009P',
    'settings.scannerLastCode': 'Erfasster Code:',
    'settings.scannerCodeType': 'Format:',
    'settings.scannerType1D': '1D Barcode (EAN / UPC)',
    'settings.scannerType2D': '2D QR-Code',
    'settings.scannerTestSuccess': 'Erfolgreich empfangen!',
    'settings.scannerResetTest': 'Test zurücksetzen',

    // Scanner UI in Dashboard / BarcodeScannerComponent
    'scanner.hardwareReady': 'Hardware-Scanner bereit',
    'scanner.hardwareWaiting': 'Warte auf Scan vom Eyoyo EY-009P...',
    'scanner.hardwareHint': 'Halte den Scanner an den Barcode des Plattencovers oder deinen Vinyl-Tracker QR-Code.',
    'scanner.badgeHardware': 'Eyoyo EY-009P aktiv',

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
    'dashboard.other': 'Andere',

    // Collection
    'collection.title': 'Schallplattensammlung',
    'collection.categoryAll': 'Alle',
    'collection.categoryVinyl': 'Platten',
    'collection.categoryCd': 'CDs',
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
    'collection.formatDoubleCd': 'Doppel-CD (2xCD)',
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
    'collection.genreFilter': 'Genre',
    'collection.genresSelected': 'Genres ({count})',
    'collection.searchGenres': 'Genre suchen...',
    'collection.allGenres': 'Alle Genres',
    'collection.clearGenres': 'Auswahl aufheben',
    'collection.yearFilter': 'Jahr',
    'collection.yearPlaceholder': 'z.B. 1970-1972, 1975',
    'collection.clearFilters': 'Filter zurücksetzen',

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
    'record.addedAt': 'Date Added',
    'record.lastListened': 'Last Listened',
    'record.never': 'Never',
    'record.notYet': 'Never',
    'record.metadata': 'Metadata',
    'record.country': 'Country',
    'record.unknownCountry': 'Country unknown',
    'record.notes': 'Notes',
    'record.discogsId': 'Discogs ID',
    'record.dbId': 'DB ID',
    'record.releaseYear': 'Release Year',
    'record.release': 'Release',
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
    'settings.qrManagementTitle': 'QR Code Management',
    'settings.qrManagementDesc': 'Generate and download a printable PDF containing QR codes for your entire Discogs collection.',
    'settings.downloadQr': 'Download QR Codes (PDF)',
    'settings.generatingQr': 'Generating QR codes...',

    // Scanner Settings
    'settings.scannerTitle': 'Barcode & QR Scanner',
    'settings.scannerDesc': 'Configure the external Eyoyo EY-009P hardware scanner (HID) or camera scanner.',
    'settings.scannerMode': 'Active Scanner Mode',
    'settings.scannerModeHardware': 'External Hardware Scanner (Eyoyo EY-009P / HID)',
    'settings.scannerModeCamera': 'Internal Camera Scanner (Webcam / Smartphone)',
    'settings.scannerModeHybrid': 'Hybrid Mode (Camera & Hardware simultaneously)',
    'settings.scannerModeDesc': 'In Hardware mode, the camera stays off, saving battery and CPU resources.',
    'settings.scannerSound': 'Audio Feedback (Beep)',
    'settings.scannerSoundDesc': 'Play a subtle confirmation beep on each scanned code.',
    'settings.scannerTestTitle': 'Scanner Live Test',
    'settings.scannerTestDesc': 'Scan a barcode or QR code with your Eyoyo scanner to verify detection.',
    'settings.scannerTestWaiting': 'Ready... Scan now with the Eyoyo EY-009P',
    'settings.scannerLastCode': 'Detected Code:',
    'settings.scannerCodeType': 'Format:',
    'settings.scannerType1D': '1D Barcode (EAN / UPC)',
    'settings.scannerType2D': '2D QR Code',
    'settings.scannerTestSuccess': 'Successfully received!',
    'settings.scannerResetTest': 'Reset Test',

    // Scanner UI in Dashboard / BarcodeScannerComponent
    'scanner.hardwareReady': 'Hardware Scanner Ready',
    'scanner.hardwareWaiting': 'Waiting for scan from Eyoyo EY-009P...',
    'scanner.hardwareHint': 'Aim the scanner at the record sleeve barcode or Vinyl Tracker QR code.',
    'scanner.badgeHardware': 'Eyoyo EY-009P active',

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
    'dashboard.other': 'Other',

    // Collection
    'collection.title': 'Vinyl Collection',
    'collection.categoryAll': 'All',
    'collection.categoryVinyl': 'Vinyl',
    'collection.categoryCd': 'CDs',
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
    'collection.formatDoubleCd': 'Double CD (2xCD)',
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
    'collection.genreFilter': 'Genre',
    'collection.genresSelected': 'Genres ({count})',
    'collection.searchGenres': 'Search genres...',
    'collection.allGenres': 'All Genres',
    'collection.clearGenres': 'Clear selection',
    'collection.yearFilter': 'Year',
    'collection.yearPlaceholder': 'e.g. 1970-1972, 1975',
    'collection.clearFilters': 'Reset filters',

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
