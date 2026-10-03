import React from 'react';
import { act, render } from '@testing-library/react-native';
import LibraryMetadataScanProgress from '../LibraryMetadataScanProgress';
import LibraryPreparationStatus from '../LibraryPreparationStatus';
import { clearImportFileProgress, publishImportFileProgress } from '../../utils/libraryImportProgress';
import { useWaveformPreparation } from '../../utils/libraryWaveformPreparation';
import { resetWaveformStatusForTests, setWaveformProgress, setWaveformStatus } from '../../utils/waveformStatus';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#eee', surfaceGlass: '#222', border: '#333',
    text: { primary: '#fff', secondary: '#ccc', muted: '#aaa' } } } }),
}));
jest.mock('../../utils/libraryWaveformPreparation', () => ({
  useWaveformPreparation: jest.fn(), cancelWaveformPreparation: jest.fn(),
  dismissWaveformPreparation: jest.fn(), resumeWaveformPreparation: jest.fn(),
}));

beforeEach(() => { clearImportFileProgress(); resetWaveformStatusForTests(); });

test('shows a current metadata title and completed-file progress, then clears the scan', () => {
  const view = render(<LibraryMetadataScanProgress />);
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
  act(() => publishImportFileProgress({ currentTitle: 'Current.mp3', processed: 1, total: 3 }));
  expect(view.getByText('1/3 · Current.mp3')).toBeTruthy();
  expect(view.getByTestId('library-metadata-scan-progress').props.accessibilityValue).toEqual({ min: 0, max: 3, now: 1 });
  expect(view.getByTestId('library-metadata-current-track').props.accessibilityValue).toEqual({ text: 'Wird gelesen' });
  act(clearImportFileProgress);
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
});

test('the current waveform title shows its own decoded PCM percentage', () => {
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'running', total: 3,
    processed: 1, ready: 1, failed: 0, currentTitle: 'Current', currentFingerprint: 'current-source' });
  setWaveformStatus('current-source', 'analyzing');
  const view = render(<LibraryPreparationStatus visible />);
  expect(view.getByTestId('library-current-track-progress').props.accessibilityValue.text).toBe('Wird vorbereitet');
  act(() => setWaveformProgress('current-source', 0.43));
  expect(view.getByTestId('library-current-track-progress').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 43 });
});
