import {
  libraryImportMessages,
  mediaCandidatesFoundStatus,
  metadataRefreshSummary,
  scanFoldersReadingStatus,
  tracksFoundStatus,
  tracksSavingStatus,
} from '../libraryImportMessages';

test('exports stable static import and refresh messages', () => {
  expect(libraryImportMessages.preparingImport).toBe('Import wird vorbereitet…');
  expect(libraryImportMessages.readingId3Metadata).toBe('ID3-Metadaten werden gelesen…');
  expect(libraryImportMessages.permissionRequiredTitle).toBe('Berechtigung benötigt');
  expect(libraryImportMessages.partiallyImportedMessage).toMatch(/Importierbare Songs/);
});

test('formats scan and import status messages', () => {
  expect(scanFoldersReadingStatus(2)).toBe('Scan-Ordner werden gelesen… (2)');
  expect(tracksFoundStatus(42)).toBe('42 Tracks gefunden. Bibliothek wird aktualisiert…');
  expect(mediaCandidatesFoundStatus(12)).toBe('12 Musikdateien gefunden…');
  expect(tracksSavingStatus(7)).toBe('7 Tracks werden gespeichert…');
});

test('formats metadata refresh summary', () => {
  expect(metadataRefreshSummary(1, 2, 3)).toBe('1 Tracks aktualisiert. 2 übersprungen. 3 fehlgeschlagen.');
});
