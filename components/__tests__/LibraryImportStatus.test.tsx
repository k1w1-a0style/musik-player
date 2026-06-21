import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryImportStatus from '../LibraryImportStatus';
import {
  beginMetadataRefreshOperation,
  completeMetadataRefreshOperation,
  resetMetadataRefreshOperationForTests,
  updateMetadataRefreshProgress,
} from '../../utils/metadataRefreshOperation';

beforeEach(() => {
  resetMetadataRefreshOperationForTests();
});

test('renders provided status text', () => {
  const { getByText } = render(<LibraryImportStatus status="Metadaten werden gelesen…" />);
  expect(getByText('Metadaten werden gelesen…')).toBeTruthy();
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

test('shows live counters while running', () => {
  beginMetadataRefreshOperation(83, 0);
  updateMetadataRefreshProgress({ processed: 67, updated: 60, skipped: 5, failed: 2 });
  const { getByTestId } = render(<LibraryImportStatus status="läuft" />);
  expect(getByTestId('library-import-status-counters').props.children).toContain('67/83');
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
