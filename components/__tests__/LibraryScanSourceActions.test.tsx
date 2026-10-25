import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LibraryScanSourceActions from '../LibraryScanSourceActions';
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  border: '#333', primary: '#0ff', text: { primary: '#fff', secondary: '#ddd', muted: '#aaa' },
} } }) }));
test.each(['Android-Musikbibliothek', 'Nur Scan-Ordner', 'Beide Quellen'])('scan starts only after explicit selection of %s', label => {
  const onImport = jest.fn(); const onDeepScan = jest.fn();
  const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={1} onImport={onImport} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Musikbibliothek aktualisieren')); expect(onImport).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText(label)); expect(onImport).toHaveBeenCalledWith({ source: label === 'Nur Scan-Ordner' ? 'folders' : label === 'Beide Quellen' ? 'both' : 'media-library' });
  expect(onDeepScan).not.toHaveBeenCalled();
});
test('full scan retains mode and folder-only sources are disabled without folders', () => {
  const onDeepScan = jest.fn(); const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={0} onImport={jest.fn()} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Weitere Scanoptionen'));
  fireEvent.press(screen.getByText('Vollständige Prüfung'));
  fireEvent.press(screen.getByText('Nur Scan-Ordner')); expect(onDeepScan).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Android-Musikbibliothek')); expect(onDeepScan).toHaveBeenCalledWith({ source: 'media-library' });
});

test('initial scan menu has one prominent scan command and hides full verification under advanced options', () => {
  const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={1}
    onImport={jest.fn()} onDeepScan={jest.fn()} />);
  expect(screen.getByText('Musikbibliothek aktualisieren')).toBeTruthy();
  expect(screen.queryByText('Vollständige Prüfung')).toBeNull();
  fireEvent.press(screen.getByText('Weitere Scanoptionen'));
  expect(screen.getByText('Vollständige Prüfung')).toBeTruthy();
});
