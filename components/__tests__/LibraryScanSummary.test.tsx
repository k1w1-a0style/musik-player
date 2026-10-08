import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import LibraryPreparationStatus from '../LibraryPreparationStatus';
import { beginLibraryScan, completeLibraryScan, dismissLibraryScan, recordLibraryScanResult,
  stopLibraryScan, updateLibraryScanProgress } from '../../utils/libraryScanOperation';
import { emptyImportScanStatistics } from '../../utils/libraryImportStatistics';
import { beginMetadataRefreshOperation, resetMetadataRefreshOperationForTests } from '../../utils/metadataRefreshOperation';

jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  primary: '#eee', surfaceGlass: '#222', border: '#333', text: { primary: '#fff', secondary: '#ccc' } } } }) }));
jest.mock('../../utils/libraryWaveformPreparation', () => ({
  useWaveformPreparation: () => ({ status: 'completed', failed: 0 }),
}));
const statistics = { ...emptyImportScanStatistics(), newCount: 1, changedCount: 2, unchangedCount: 3, unverifiedCount: 4, errorCount: 1 };
const progress = { processed: 11, total: 20, currentTitle: '', statistics };

beforeEach(() => {
  stopLibraryScan(beginLibraryScan(false), 'cancelled');
  dismissLibraryScan();
  resetMetadataRefreshOperationForTests();
});

test('retains an honest completed scan summary after the import and preparation controls disappear', () => {
  const id = beginLibraryScan(false);
  const view = render(<LibraryPreparationStatus visible={false} />);
  act(() => { updateLibraryScanProgress(id, progress); recordLibraryScanResult(id, { statistics }); completeLibraryScan(id); });
  expect(view.getByText('Schnellscan – abgeschlossen')).toBeTruthy();
  expect(view.getByTestId('library-scan-summary-counts').props.children).toBe('Neu: 1 · Geändert: 2 · Unverändert: 3 · Ungeprüft: 4 · Leseprobleme: 1');
  expect(view.getByText(/bekannte Dateien ohne verlässliche Änderungsdaten/)).toBeTruthy();
  expect(view.queryByTestId('library-import-scan-animation')).toBeNull();
  fireEvent.press(view.getByLabelText('Scan-Ergebnis ausblenden'));
  expect(view.queryByTestId('library-scan-summary')).toBeNull();
});

test('cancellation flushes the newest internal counters and rejects old-generation responses during the next scan', () => {
  const first = beginLibraryScan(false);
  updateLibraryScanProgress(first, progress);
  const view = render(<LibraryPreparationStatus visible={false} />);
  const latest = { ...progress, processed: 12, statistics: { ...statistics, newCount: 2 } };
  act(() => { updateLibraryScanProgress(first, latest, false); });
  expect(view.queryByText(/12 von/)).toBeNull();
  act(() => stopLibraryScan(first, 'cancelled'));
  expect(view.getByText('Schnellscan – abgebrochen')).toBeTruthy();
  expect(view.getByText('12 von 20 gefundenen Dateien verarbeitet')).toBeTruthy();
  let second = 0;
  act(() => { second = beginLibraryScan(true); });
  expect(view.queryByTestId('library-scan-summary')).toBeNull();
  act(() => { updateLibraryScanProgress(first, progress); completeLibraryScan(first); stopLibraryScan(first, 'failed'); });
  expect(view.queryByTestId('library-scan-summary')).toBeNull();
  act(() => { updateLibraryScanProgress(second, progress); recordLibraryScanResult(second, { statistics, completed: false, remainingCount: 9 }); completeLibraryScan(second); });
  expect(view.getByText('Vollständiger Scan – teilweise abgeschlossen')).toBeTruthy();
  expect(view.getByText('9 Datei(en) noch nicht geprüft')).toBeTruthy();
  expect(view.getByText(/umfasst auch neue\/geänderte Dateien/)).toBeTruthy();
});

test('does not report a completed scan when permission/confirmation ended the import before processing', () => {
  const id = beginLibraryScan(false);
  const view = render(<LibraryPreparationStatus visible={false} />);
  act(() => { recordLibraryScanResult(id, {}); completeLibraryScan(id); });
  expect(view.queryByTestId('library-scan-summary')).toBeNull();
});

test('shows failed scan counters, but keeps them separate from an active metadata refresh', () => {
  const id = beginLibraryScan(false);
  const view = render(<LibraryPreparationStatus visible={false} />);
  act(() => { updateLibraryScanProgress(id, progress); stopLibraryScan(id, 'failed'); });
  expect(view.getByText('Schnellscan – fehlgeschlagen')).toBeTruthy();
  act(() => { beginMetadataRefreshOperation(2, 0); });
  expect(view.queryByTestId('library-scan-summary')).toBeNull();
});

test('does not dismiss a running scan or duplicate its progress bar', () => {
  const id = beginLibraryScan(true);
  updateLibraryScanProgress(id, { ...progress, statistics: emptyImportScanStatistics() });
  const view = render(<LibraryPreparationStatus visible scanning status="Dateien prüfen…" />);
  act(dismissLibraryScan);
  expect(view.getByText('Vollständiger Scan – läuft')).toBeTruthy();
  expect(view.queryByLabelText('Scan-Ergebnis ausblenden')).toBeNull();
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
  expect(view.queryByText(/Ungeprüft: bekannte/)).toBeNull();
});
