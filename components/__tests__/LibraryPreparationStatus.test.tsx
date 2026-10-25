import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import LibraryPreparationStatus from '../LibraryPreparationStatus';
import { beginMetadataRefreshOperation, markMetadataRefreshCancelling, resetMetadataRefreshOperationForTests } from '../../utils/metadataRefreshOperation';

const mockCancelWaveform = jest.fn();
jest.mock('../../utils/libraryWaveformPreparation', () => ({
  useWaveformPreparation: () => ({ status: 'running', processed: 3, total: 10, failed: 0, currentTitle: 'Current waveform' }),
  cancelWaveformPreparation: () => mockCancelWaveform(), resumeWaveformPreparation: jest.fn(),
}));
jest.mock('../../utils/libraryScanOperation', () => ({
  useLibraryScanOperation: () => ({ id: 1, fullScan: false, status: 'idle' }), dismissLibraryScan: jest.fn(),
}));
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  primary: '#eee', surfaceGlass: '#222', border: '#333', error: '#f00', warning: '#ff0',
  text: { primary: '#fff', secondary: '#ccc', onPrimary: '#000' } } } }) }));

beforeEach(() => { resetMetadataRefreshOperationForTests(); mockCancelWaveform.mockClear(); });

test('refresh cancellation keeps independent waveform progress and its cancel control available', () => {
  beginMetadataRefreshOperation(10, 0);
  const cancelRefresh = jest.fn(() => markMetadataRefreshCancelling());
  const view = render(<LibraryPreparationStatus visible onCancelRefresh={cancelRefresh} />);
  expect(view.queryByTestId('library-import-status')).toBeNull();
  fireEvent.press(view.getByLabelText('Verarbeitungsdetails öffnen'));
  fireEvent.press(view.getByLabelText('Aktualisierung abbrechen'));
  expect(cancelRefresh).toHaveBeenCalledTimes(1);
  expect(view.getByTestId('library-waveform-preparation')).toBeTruthy();
  expect(view.getByLabelText('Waveformanalyse abbrechen')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Waveformanalyse abbrechen'));
  expect(mockCancelWaveform).toHaveBeenCalledTimes(1);
});

test('waveform statistics stay behind details and controls retain 48 dp targets', () => {
  const view = render(<LibraryPreparationStatus visible={false} />);
  expect(view.queryByText('Current waveform')).toBeNull();
  const details = view.getByLabelText('Verarbeitungsdetails öffnen');
  expect(StyleSheet.flatten(details.props.style).minHeight).toBe(48);
  act(() => fireEvent.press(details));
  expect(view.getByText('Current waveform')).toBeTruthy();
  expect(view.getByText('3/10 analysiert · 0 fehlgeschlagen')).toBeTruthy();
});
