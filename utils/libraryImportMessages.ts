export const libraryImportMessages = {
  preparingImport: 'Import wird vorbereitet…',
  scanningMediaLibrary: 'Medienbibliothek wird durchsucht…',
  importingMetadataAndCovers: 'Metadaten und Cover werden importiert…',
  readingId3Metadata: 'ID3-Metadaten werden gelesen…',
  importRunning: 'Import läuft…',
  scanFoldersTimeout: 'Import läuft zu lange. Bitte kleinere Ordner testen oder Ordnerberechtigung neu setzen.',
  mediaLibraryScanTimeout: 'Medienbibliothek-Scan läuft zu lange.',
  metadataImportTimeout: 'Metadaten-Import läuft zu lange.',
  metadataRefreshTimeout: 'Metadaten-Aktualisierung läuft zu lange. Bitte später erneut versuchen.',
  noSongsTitle: 'Keine Titel',
  noSongsMetadataMessage: 'Importiere zuerst Musik, bevor Metadaten aktualisiert werden.',
  metadataUpdatedTitle: 'Metadaten aktualisiert',
  metadataPartiallyUpdatedTitle: 'Metadaten teilweise aktualisiert',
  metadataUpdateStoppedTitle: 'Metadaten-Update gestoppt',
  metadataUpdateFallbackError: 'Metadaten konnten nicht aktualisiert werden.',
  importStoppedTitle: 'Import gestoppt',
  importFallbackError: 'Medienbibliothek konnte nicht gelesen werden.',
  permissionRequiredTitle: 'Berechtigung benötigt',
  permissionRequiredMessage: 'Ohne Zugriff können keine Titel importiert werden.',
  noMusicFoundTitle: 'Keine Musik gefunden',
  noMatchingMusicMessage: 'Es wurden keine passenden Musikdateien gefunden.',
  noAudioInScanFoldersMessage: 'In den gewählten Scan-Ordnern wurden keine Audio-Dateien gefunden.',
  scanFailedTitle: 'Scan fehlgeschlagen',
  scanFailedMessage: 'In den Scan-Ordnern wurden keine importierbaren Titel gefunden. Einige Ordner/Dateien waren nicht lesbar.',
  partiallyImportedTitle: 'Teilweise importiert',
  partiallyImportedMessage: 'Einige Ordner/Dateien waren nicht lesbar. Importierbare Titel wurden trotzdem übernommen.',
};

export const scanFoldersReadingStatus = (count: number): string =>
  `Scan-Ordner werden gelesen… (${count})`;

export const tracksFoundStatus = (count: number): string =>
  `${count} Titel gefunden. Bibliothek wird aktualisiert…`;

export const mediaCandidatesFoundStatus = (count: number): string =>
  `${count} Musikdateien gefunden…`;

export const tracksSavingStatus = (count: number): string =>
  `${count} Titel werden gespeichert…`;

export const metadataRefreshSummary = (updated: number, skipped: number, failed: number): string =>
  `${updated} Titel aktualisiert. ${skipped} übersprungen. ${failed} fehlgeschlagen.`;

export const metadataRefreshPartialSummary = (processed: number, total: number): string =>
  `${processed} von ${total} Titeln wurden geprüft. Starte die Aktualisierung erneut, um fortzufahren.`;

export interface MetadataRefreshProgress {
  processed: number;
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

export const metadataRefreshProgressStatus = ({ processed, total, updated, skipped, failed }: MetadataRefreshProgress): string =>
  `Metadaten ${processed}/${total} · ${updated} aktualisiert · ${skipped} übersprungen · ${failed} fehlgeschlagen`;
