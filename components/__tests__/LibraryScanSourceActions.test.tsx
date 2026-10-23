import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LibraryScanSourceActions from '../LibraryScanSourceActions';
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  border: '#333', primary: '#0ff', text: { primary: '#fff', secondary: '#ddd', muted: '#aaa' },
} } }) }));
test.each(['Android-Musikbibliothek', 'Nur Scan-Ordner', 'Beide Quellen'])('scan starts only after explicit selection of %s', label => {
  const onImport = jest.fn(); const onDeepScan = jest.fn();
  const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={1} onImport={onImport} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Schnellscan / Import')); expect(onImport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(label)); expect(onImport).toHaveBeenCalledWith({ source: label === 'Nur Scan-Ordner' ? 'folders' : label === 'Beide Quellen' ? 'both' : 'media-library' });
  expect(onDeepScan).not.toHaveBeenCalled();
});
test('full scan retains mode and folder-only sources are disabled without folders', () => {
  const onDeepScan = jest.fn(); const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={0} onImport={jest.fn()} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Vollständiger Scan'));
  fireEvent.press(screen.getByText('Nur Scan-Ordner')); expect(onDeepScan).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Android-Musikbibliothek')); expect(onDeepScan).toHaveBeenCalledWith({ source: 'media-library' });
});
