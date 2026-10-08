import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryPreparationStatus from '../LibraryPreparationStatus';
import {
  beginMetadataRefreshOperation, completeMetadataRefreshOperation,
  resetMetadataRefreshOperationForTests,
} from '../../utils/metadataRefreshOperation';
import { cancelWaveformPreparation, useWaveformPreparation } from '../../utils/libraryWaveformPreparation';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: {
    primary: '#ddd', surfaceGlass: '#222', border: '#333', error: '#f88', warning: '#ff8',
    text: { primary: '#fff', secondary: '#ccc', onPrimary: '#000' },
  } } }),
}));
jest.mock('../../utils/libraryWaveformPreparation', () => ({
  useWaveformPreparation: jest.fn(), cancelWaveformPreparation: jest.fn(),
  resumeWaveformPreparation: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetMetadataRefreshOperationForTests();
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'idle' });
});

test('offers cancellation of a folder scan independently of metadata refresh', () => {
  const onCancelScan = jest.fn();
  const view = render(<LibraryPreparationStatus visible scanning status="Ordner wird geprüft…"
    onCancelScan={onCancelScan} />);
  fireEvent.press(view.getByLabelText('Scan abbrechen'));
  expect(onCancelScan).toHaveBeenCalledTimes(1);
});

test('a running waveform preparation cannot replace the active folder scan controls', () => {
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'running', total: 3, processed: 1 });
  const onCancelScan = jest.fn();
  const view = render(<LibraryPreparationStatus visible scanning status="Ordner wird geprüft…"
    onCancelScan={onCancelScan} />);
  expect(view.getByText('Ordner wird geprüft…')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Scan abbrechen'));
  expect(onCancelScan).toHaveBeenCalledTimes(1);
  expect(cancelWaveformPreparation).not.toHaveBeenCalled();
});

test('a previous resumable metadata refresh cannot offer resume instead of scan cancellation', () => {
  beginMetadataRefreshOperation(10, 0);
  completeMetadataRefreshOperation('resumable');
  const onCancelScan = jest.fn();
  const onResumeRefresh = jest.fn();
  const view = render(<LibraryPreparationStatus visible scanning onCancelScan={onCancelScan}
    onResumeRefresh={onResumeRefresh} />);
  expect(view.queryByLabelText('Aktualisierung fortsetzen')).toBeNull();
  fireEvent.press(view.getByLabelText('Scan abbrechen'));
  expect(onCancelScan).toHaveBeenCalledTimes(1);
  expect(onResumeRefresh).not.toHaveBeenCalled();
});
