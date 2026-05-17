import {
  buildImportedSongsUpdate,
  buildMediaLibraryCandidatesResult,
  buildMediaLibraryImportResult,
  buildMediaLibraryPermissionResult,
  buildMetadataRefreshAvailabilityResult,
  buildScanImportResult,
  getEmptyMediaLibraryImportAlert,
  getEmptyScanImportAlert,
  getImportStoppedAlert,
  getLibraryImportFlowCopy,
  getMediaLibraryImportProgressCopy,
  getMediaLibraryPermissionDeniedAlert,
  getMetadataRefreshCompleteAlert,
  getMetadataRefreshFlowCopy,
  getMetadataUpdateStoppedAlert,
  getNoSongsMetadataAlert,
  getPartialScanImportAlert,
  getScanImportProgressCopy,
  hasImportErrors,
  hasMediaLibraryCandidates,
  hasMediaLibraryPermission,
  hasSongsForMetadataRefresh,
  shouldApplyMetadataRefresh,
  shouldImportFromScanFolders,
} from '../libraryImportFlow';
import {
  libraryImportMessages,
  mediaCandidatesFoundStatus,
  metadataRefreshSummary,
  scanFoldersReadingStatus,
  tracksFoundStatus,
  tracksSavingStatus,
} from '../libraryImportMessages';
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
    title: libraryImportMessages.permissionRequiredTitle,
    message: libraryImportMessages.permissionRequiredMessage,
  });
});

test('buildMediaLibraryPermissionResult returns granted result for granted status', () => {
  expect(buildMediaLibraryPermissionResult('granted')).toEqual({ kind: 'granted' });
});

test('buildMediaLibraryPermissionResult returns denied alert for non-granted status', () => {
  expect(buildMediaLibraryPermissionResult('denied')).toEqual({
    kind: 'denied',
    alert: getMediaLibraryPermissionDeniedAlert(),
  });
});

test('hasMediaLibraryCandidates checks candidate counts', () => {
  expect(hasMediaLibraryCandidates(0)).toBe(false);
  expect(hasMediaLibraryCandidates(1)).toBe(true);
});

test('getEmptyMediaLibraryImportAlert returns no matching music alert', () => {
  expect(getEmptyMediaLibraryImportAlert()).toEqual({
    title: libraryImportMessages.noMusicFoundTitle,
    message: libraryImportMessages.noMatchingMusicMessage,
  });
});

test('buildMediaLibraryCandidatesResult returns empty alert without candidates', () => {
  expect(buildMediaLibraryCandidatesResult(0)).toEqual({
    kind: 'empty',
    alert: getEmptyMediaLibraryImportAlert(),
  });
});

test('buildMediaLibraryCandidatesResult returns available result with candidates', () => {
  expect(buildMediaLibraryCandidatesResult(1)).toEqual({ kind: 'available' });
});

test('getPartialScanImportAlert returns partial import alert', () => {
  expect(getPartialScanImportAlert()).toEqual({
    title: libraryImportMessages.partiallyImportedTitle,
    message: libraryImportMessages.partiallyImportedMessage,
  });
});

test('getScanImportProgressCopy returns scan progress and timeout copy', () => {
  expect(getScanImportProgressCopy(2, 5)).toEqual({
    readingStatus: scanFoldersReadingStatus(2),
    foundStatus: tracksFoundStatus(5),
    timeoutMessage: libraryImportMessages.scanFoldersTimeout,
  });
});

test('getMediaLibraryImportProgressCopy returns media library progress copy', () => {
  expect(getMediaLibraryImportProgressCopy(7, 3)).toEqual({
    candidatesFoundStatus: mediaCandidatesFoundStatus(7),
    savingStatus: tracksSavingStatus(3),
  });
});

test('getLibraryImportFlowCopy returns import status and timeout copy', () => {
  expect(getLibraryImportFlowCopy()).toEqual({
    preparingStatus: libraryImportMessages.preparingImport,
    scanFoldersTimeoutMessage: libraryImportMessages.scanFoldersTimeout,
    scanningMediaLibraryStatus: libraryImportMessages.scanningMediaLibrary,
    mediaLibraryScanTimeoutMessage: libraryImportMessages.mediaLibraryScanTimeout,
    importingMetadataAndCoversStatus: libraryImportMessages.importingMetadataAndCovers,
    metadataImportTimeoutMessage: libraryImportMessages.metadataImportTimeout,
  });
});

test('getMetadataRefreshFlowCopy returns status and timeout copy', () => {
  expect(getMetadataRefreshFlowCopy()).toEqual({
    readingStatus: libraryImportMessages.readingId3Metadata,
    timeoutMessage: libraryImportMessages.metadataRefreshTimeout,
  });
});

test('hasSongsForMetadataRefresh checks song counts', () => {
  expect(hasSongsForMetadataRefresh(0)).toBe(false);
  expect(hasSongsForMetadataRefresh(1)).toBe(true);
});

test('buildMetadataRefreshAvailabilityResult returns empty alert without songs', () => {
  expect(buildMetadataRefreshAvailabilityResult(0)).toEqual({
    kind: 'empty',
    alert: getNoSongsMetadataAlert(),
  });
});

test('buildMetadataRefreshAvailabilityResult returns ready result with songs', () => {
  expect(buildMetadataRefreshAvailabilityResult(1)).toEqual({ kind: 'ready' });
});

test('shouldApplyMetadataRefresh checks updated counts', () => {
  expect(shouldApplyMetadataRefresh(0)).toBe(false);
  expect(shouldApplyMetadataRefresh(1)).toBe(true);
});

test('getNoSongsMetadataAlert returns metadata refresh empty-state alert', () => {
  expect(getNoSongsMetadataAlert()).toEqual({
    title: libraryImportMessages.noSongsTitle,
    message: libraryImportMessages.noSongsMetadataMessage,
  });
});

test('getMetadataRefreshCompleteAlert returns metadata refresh summary alert', () => {
  expect(getMetadataRefreshCompleteAlert(2, 3, 4)).toEqual({
    title: libraryImportMessages.metadataUpdatedTitle,
    message: metadataRefreshSummary(2, 3, 4),
  });
});

test('getImportStoppedAlert uses error message when available', () => {
  expect(getImportStoppedAlert(new Error('Boom'))).toEqual({
    title: libraryImportMessages.importStoppedTitle,
    message: 'Boom',
  });
});

test('getImportStoppedAlert uses fallback for non-error values', () => {
  expect(getImportStoppedAlert('oops')).toEqual({
    title: libraryImportMessages.importStoppedTitle,
    message: libraryImportMessages.importFallbackError,
  });
});

test('getMetadataUpdateStoppedAlert uses error message when available', () => {
  expect(getMetadataUpdateStoppedAlert(new Error('Broken ID3'))).toEqual({
    title: libraryImportMessages.metadataUpdateStoppedTitle,
    message: 'Broken ID3',
  });
});

test('getMetadataUpdateStoppedAlert uses fallback for non-error values', () => {
  expect(getMetadataUpdateStoppedAlert(null)).toEqual({
    title: libraryImportMessages.metadataUpdateStoppedTitle,
    message: libraryImportMessages.metadataUpdateFallbackError,
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

test('buildMediaLibraryImportResult returns success update', () => {
  expect(buildMediaLibraryImportResult([song('old')], [song('new')])).toEqual({
    kind: 'success',
    update: buildImportedSongsUpdate([song('old')], [song('new')]),
  });
});

test('buildScanImportResult returns empty alert when no songs were imported', () => {
  expect(buildScanImportResult([song('old')], [], ['boom'])).toEqual({
    kind: 'empty',
    alert: getEmptyScanImportAlert(['boom']),
  });
});

test('buildScanImportResult returns update and optional partial alert on success', () => {
  const result = buildScanImportResult([song('old')], [song('new')], ['minor']);

  expect(result).toEqual({
    kind: 'success',
    update: buildImportedSongsUpdate([song('old')], [song('new')]),
    partialAlert: getPartialScanImportAlert(),
  });
});

test('buildScanImportResult omits partial alert when success has no errors', () => {
  const result = buildScanImportResult([song('old')], [song('new')], []);

  expect(result).toEqual({
    kind: 'success',
    update: buildImportedSongsUpdate([song('old')], [song('new')]),
  });
});

test('getEmptyScanImportAlert returns scan failed alert when errors exist', () => {
  expect(getEmptyScanImportAlert(['boom'])).toEqual({
    title: libraryImportMessages.scanFailedTitle,
    message: libraryImportMessages.scanFailedMessage,
  });
});

test('getEmptyScanImportAlert returns no music alert without errors', () => {
  expect(getEmptyScanImportAlert([])).toEqual({
    title: libraryImportMessages.noMusicFoundTitle,
    message: libraryImportMessages.noAudioInScanFoldersMessage,
  });
});
