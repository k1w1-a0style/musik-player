import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import LibraryImportStatus from '../LibraryImportStatus';
import LibraryPreparationStatus from '../LibraryPreparationStatus';
import { clearImportFileProgress, publishImportFileProgress } from '../../utils/libraryImportProgress';
import { cancelWaveformPreparation, resumeWaveformPreparation, useWaveformPreparation } from '../../utils/libraryWaveformPreparation';
import { resetWaveformStatusForTests } from '../../utils/waveformStatus';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({ theme: { palette: { primary: '#eee', surfaceGlass: '#222', border: '#333',
    text: { primary: '#fff', secondary: '#ccc', muted: '#aaa' } } } }),
}));
jest.mock('../../utils/libraryWaveformPreparation', () => ({
  useWaveformPreparation: jest.fn(), cancelWaveformPreparation: jest.fn(),
  resumeWaveformPreparation: jest.fn(),
}));

beforeEach(() => { clearImportFileProgress(); resetWaveformStatusForTests(); });

test('a previous completed preparation does not hide a new folder discovery scan', () => {
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'completed', failed: 0, ready: 3 });
  const view = render(<LibraryPreparationStatus visible scanning status="Ordner wird geprüft…" />);
  expect(view.getByTestId('library-import-scan-animation')).toBeTruthy();
  expect(view.queryByText('Ordner wird geprüft…')).toBeNull();
  fireEvent.press(view.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(view.getByText('Ordner wird geprüft…')).toBeTruthy();
});

test('does not add either top progress bar while metadata is being read', () => {
  const view = render(<LibraryImportStatus status="Dateien prüfen…" />);
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
  act(() => publishImportFileProgress({ currentTitle: 'Current.mp3', processed: 1, total: 3 }));
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
  expect(view.queryByTestId('library-metadata-current-track')).toBeNull();
  act(clearImportFileProgress);
  expect(view.queryByTestId('library-metadata-scan-progress')).toBeNull();
});

test('keeps only a compact scan control; only unfinished tracks animate', () => {
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'running', total: 3,
    processed: 1, ready: 1, failed: 0, currentTitle: 'Current', currentFingerprint: 'current-source' });
  const view = render(<LibraryPreparationStatus visible />);
  expect(view.queryByText('Scan fertig – Waveforms werden vorbereitet')).toBeNull();
  expect(view.getByTestId('library-processing-control')).toBeTruthy();
  expect(view.queryByTestId('library-waveform-preparation')).toBeNull();
  fireEvent.press(view.getByLabelText('Verarbeitungsdetails öffnen'));
  expect(view.queryByTestId('library-current-track-progress')).toBeNull();
  expect(view.queryByTestId('library-waveform-preparation-counts')).toBeNull();
  fireEvent.press(view.getByText('Abbrechen'));
  expect(cancelWaveformPreparation).toHaveBeenCalled();
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'cancelled', failed: 0 });
  view.rerender(<LibraryPreparationStatus visible />);
  fireEvent.press(view.getByText('Fortsetzen'));
  expect(resumeWaveformPreparation).toHaveBeenCalled();
  (useWaveformPreparation as jest.Mock).mockReturnValue({ status: 'completed', failed: 0, ready: 3 });
  view.rerender(<LibraryPreparationStatus visible />);
  expect(view.queryByTestId('library-waveform-preparation')).toBeNull();
});


test('shows bounded file progress only while the metadata scan is active', () => {
  const view = render(<LibraryImportStatus scanning status="Metadaten werden gelesen…" />);
  act(() => publishImportFileProgress({ currentTitle: 'Älterer Mix.mp3', processed: 4, total: 10 }));
  expect(view.queryByText('Metadaten: 4/10')).toBeNull();
  fireEvent.press(view.getByLabelText('Scan-Details'));
  expect(view.getByText('Metadaten: 4/10')).toBeTruthy();
  expect(view.getByText('Älterer Mix.mp3')).toBeTruthy();
  view.rerender(<LibraryImportStatus scanning={false} status="Bibliothek gespeichert" />);
  expect(view.queryByText('Älterer Mix.mp3')).toBeNull();
});
