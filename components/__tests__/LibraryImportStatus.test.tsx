import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryImportStatus from '../LibraryImportStatus';
import {
  beginMetadataRefreshOperation,
  completeMetadataRefreshOperation,
  resetMetadataRefreshOperationForTests,
  updateMetadataRefreshProgress,
} from '../../utils/metadataRefreshOperation';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    error: '#FF6F8A',
    warning: '#FFCA77',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: () => undefined,
    setSkin: () => undefined,
    theme: mockAppTheme,
  }),
}));

beforeEach(() => {
  resetMetadataRefreshOperationForTests();
});

test('renders provided status text', () => {
  const { getByText } = render(<LibraryImportStatus status="Metadaten werden gelesen…" />);
  expect(getByText('Metadaten werden gelesen…')).toBeTruthy();
});

test('animates a regular folder scan independently of the metadata refresh operation', () => {
  const view = render(<LibraryImportStatus status="Ordner wird geprüft…" scanning />);
  expect(view.getByTestId('library-import-scan-animation')).toBeTruthy();
  view.rerender(<LibraryImportStatus status="Alles aktuell" scanning={false} />);
  expect(view.queryByTestId('library-import-scan-animation')).toBeNull();
});

test('renders fallback status when none is provided', () => {
  const { getByText } = render(<LibraryImportStatus status={null} />);
  expect(getByText('Import läuft…')).toBeTruthy();
});

test('shows abort button while the refresh is running and calls back', () => {
  beginMetadataRefreshOperation(20, 0);
  updateMetadataRefreshProgress({ processed: 5, updated: 3 });
  const onCancel = jest.fn();
  const { getByTestId } = render(<LibraryImportStatus status="läuft" onCancelRefresh={onCancel} />);
  const button = getByTestId('library-import-status-cancel');
  fireEvent.press(button);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('keeps the scan header compact without counters or progress bars', () => {
  beginMetadataRefreshOperation(83, 0);
  updateMetadataRefreshProgress({ processed: 67, updated: 60, skipped: 5, failed: 2 });
  const { queryByTestId } = render(<LibraryImportStatus status="läuft" />);
  expect(queryByTestId('library-import-status-counters')).toBeNull();
  expect(queryByTestId('library-metadata-scan-progress')).toBeNull();
  expect(queryByTestId('library-metadata-current-track')).toBeNull();
});

test('shows resume button when refresh paused with partial progress', () => {
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({ processed: 4, resumeIndex: 4 });
  completeMetadataRefreshOperation('resumable');
  const onResume = jest.fn();
  const { getByTestId, queryByTestId } = render(<LibraryImportStatus status={null} onResumeRefresh={onResume} />);
  expect(queryByTestId('library-import-status-cancel')).toBeNull();
  const resume = getByTestId('library-import-status-resume');
  fireEvent.press(resume);
  expect(onResume).toHaveBeenCalledTimes(1);
});

test('renders error list when failed files are reported', () => {
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({
    processed: 10,
    failed: 2,
    errorDetails: [
      { uri: 'file:///music/broken.mp3', reason: 'timeout' },
      { uri: 'file:///music/corrupt.mp3', reason: 'unbekannt' },
    ],
  });
  completeMetadataRefreshOperation('resumable');
  const { getByText, getByTestId } = render(<LibraryImportStatus status={null} />);
  expect(getByTestId('library-import-status-errors')).toBeTruthy();
  expect(getByText(/broken\.mp3 – timeout/)).toBeTruthy();
});

test('limits rendered error rows and reports the remaining count', () => {
  beginMetadataRefreshOperation(10, 0);
  updateMetadataRefreshProgress({
    processed: 10,
    failed: 5,
    errorDetails: [
      { uri: 'file:///music/one.mp3', reason: 'timeout' },
      { uri: 'file:///music/two.mp3', reason: 'timeout' },
      { uri: 'file:///music/three.mp3', reason: 'timeout' },
      { uri: 'file:///music/four.mp3', reason: 'timeout' },
      { uri: 'file:///music/five.mp3', reason: 'timeout' },
    ],
  });
  completeMetadataRefreshOperation('resumable');

  const { getByText, queryByText } = render(<LibraryImportStatus status={null} />);

  expect(getByText('… und 2 weitere')).toBeTruthy();
  expect(queryByText(/four\.mp3/)).toBeNull();
  expect(queryByText(/five\.mp3/)).toBeNull();
});
