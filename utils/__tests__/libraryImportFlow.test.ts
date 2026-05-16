import {
  getEmptyMediaLibraryImportAlert,
  getEmptyScanImportAlert,
  hasImportErrors,
  hasMediaLibraryCandidates,
  shouldImportFromScanFolders,
} from '../libraryImportFlow';
import type { ScanFolder } from '../../types/ScanFolder';

const folder = (id = 'f1'): ScanFolder => ({
  id,
  name: 'Music',
  uri: `content://${id}`,
  addedAt: 1,
  enabled: true,
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
