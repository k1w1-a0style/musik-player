import {
  buildImportedSongsUpdate,
  getEmptyMediaLibraryImportAlert,
  getEmptyScanImportAlert,
  getImportStoppedAlert,
  getMediaLibraryPermissionDeniedAlert,
  getMetadataRefreshCompleteAlert,
  getMetadataUpdateStoppedAlert,
  getNoSongsMetadataAlert,
  hasImportErrors,
  hasMediaLibraryCandidates,
  hasMediaLibraryPermission,
  hasSongsForMetadataRefresh,
  shouldApplyMetadataRefresh,
  shouldImportFromScanFolders,
} from '../libraryImportFlow';
import type { ScanFolder } from '../../types/ScanFolder';
import type { Song } from '../../types/Song';

const folder = (id = 'f1'): ScanFolder => ({
  id,
  name: 'Music',
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
});

const song = (id: string, title = id): Song => ({
  id,
  title,
  artist: 'Artist',
  album: 'Album',
  uri: `file://${id}.mp3`,
});

test('shouldImportFromScanFolders only uses folders on android', () => {
  expect(shouldImportFromScanFolders([folder()], 'android')).toBe(true);
  expect(shouldImportFromScanFolders([folder()], 'ios')).toBe(false);
  expect(shouldImportFromScanFolders([], 'android')).toBe(false);
});

test('hasImportErrors checks optional error arrays', () => {
  expect(hasImportErrors(undefined)).toBe(false);
  expect(hasImportErrors([])).toBe(false);
  expect(hasImportErrors(['boom'])).toBe(true);
});

test('hasMediaLibraryPermission only accepts granted status', () => {
  expect(hasMediaLibraryPermission('granted')).toBe(true);
  expect(hasMediaLibraryPermission('denied')).toBe(false);
  expect(hasMediaLibraryPermission('undetermined')).toBe(false);
});

test('getMediaLibraryPermissionDeniedAlert returns permission alert', () => {
  expect(getMediaLibraryPermissionDeniedAlert()).toEqual({
    title: 'Berechtigung benötigt',
    message: 'Ohne Zugriff können keine Songs importiert werden.',
  });
});

test('hasMediaLibraryCandidates checks candidate counts', () => {
  expect(hasMediaLibraryCandidates(0)).toBe(false);
  expect(hasMediaLibraryCandidates(1)).toBe(true);
});

test('getEmptyMediaLibraryImportAlert returns no matching music alert', () => {
  expect(getEmptyMediaLibraryImportAlert()).toEqual({
    title: 'Keine Musik gefunden',
    message: 'Es wurden keine passenden Musikdateien gefunden.',
  });
});

test('hasSongsForMetadataRefresh checks song counts', () => {
  expect(hasSongsForMetadataRefresh(0)).toBe(false);
  expect(hasSongsForMetadataRefresh(1)).toBe(true);
});

test('shouldApplyMetadataRefresh checks updated counts', () => {
  expect(shouldApplyMetadataRefresh(0)).toBe(false);
  expect(shouldApplyMetadataRefresh(1)).toBe(true);
});

test('getNoSongsMetadataAlert returns metadata refresh empty-state alert', () => {
  expect(getNoSongsMetadataAlert()).toEqual({
    title: 'Keine Songs',
    message: 'Importiere zuerst Musik, bevor Metadaten aktualisiert werden.',
  });
});

test('getMetadataRefreshCompleteAlert returns metadata refresh summary alert', () => {
  expect(getMetadataRefreshCompleteAlert(2, 3, 4)).toEqual({
    title: 'Metadaten aktualisiert',
    message: '2 Tracks aktualisiert. 3 übersprungen. 4 fehlgeschlagen.',
  });
});

test('getImportStoppedAlert uses error message when available', () => {
  expect(getImportStoppedAlert(new Error('Boom'))).toEqual({
    title: 'Import gestoppt',
    message: 'Boom',
  });
});

test('getImportStoppedAlert uses fallback for non-error values', () => {
  expect(getImportStoppedAlert('oops')).toEqual({
    title: 'Import gestoppt',
    message: 'Medienbibliothek konnte nicht gelesen werden.',
  });
});

test('getMetadataUpdateStoppedAlert uses error message when available', () => {
  expect(getMetadataUpdateStoppedAlert(new Error('ID3 kaputt'))).toEqual({
    title: 'Metadaten-Update gestoppt',
    message: 'ID3 kaputt',
  });
});

test('getMetadataUpdateStoppedAlert uses fallback for non-error values', () => {
  expect(getMetadataUpdateStoppedAlert(null)).toEqual({
    title: 'Metadaten-Update gestoppt',
    message: 'Metadaten konnten nicht aktualisiert werden.',
  });
});

test('buildImportedSongsUpdate merges songs, sorts by title and selects tracks tab', () => {
  const update = buildImportedSongsUpdate([song('old'), song('same', 'Old title')], [song('same', 'New title'), song('new')]);

  expect(update.activeTab).toBe('tracks');
  expect(update.songs).toEqual([
    song('new'),
    song('same', 'New title'),
    song('old'),
  ]);
});

test('getEmptyScanImportAlert returns scan failed alert when errors exist', () => {
  expect(getEmptyScanImportAlert(['boom'])).toEqual({
    title: 'Scan fehlgeschlagen',
    message: 'In den Scan-Ordnern wurden keine importierbaren Songs gefunden. Einige Ordner/Dateien waren nicht lesbar.',
  });
});

test('getEmptyScanImportAlert returns no music alert without errors', () => {
  expect(getEmptyScanImportAlert([])).toEqual({
    title: 'Keine Musik gefunden',
    message: 'In den gewählten Scan-Ordnern wurden keine Audio-Dateien gefunden.',
  });
});
