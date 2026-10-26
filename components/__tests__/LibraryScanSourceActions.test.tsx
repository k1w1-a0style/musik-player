import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LibraryScanSourceActions from '../LibraryScanSourceActions';
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  border: '#333', primary: '#0ff', text: { primary: '#fff', secondary: '#ddd', muted: '#aaa' },
} } }) }));
test.each([0, 1, 3])('one action starts automatic source discovery with %s folders', activeFolders => {
  const onImport = jest.fn(); const onDeepScan = jest.fn();
  const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={activeFolders} onImport={onImport} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Musikbibliothek aktualisieren'));
  expect(onImport).toHaveBeenCalledTimes(1); expect(onImport).toHaveBeenCalledWith();
  for (const label of ['Android-Musikbibliothek', 'Nur Scan-Ordner', 'Beide Quellen']) expect(screen.queryByText(label)).toBeNull();
  expect(onDeepScan).not.toHaveBeenCalled();
});
test('full verification remains an explicit advanced action', () => {
  const onDeepScan = jest.fn(); const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={0} onImport={jest.fn()} onDeepScan={onDeepScan} />);
  fireEvent.press(screen.getByText('Weitere Scanoptionen'));
  fireEvent.press(screen.getByText('Vollständige Prüfung'));
  expect(onDeepScan).toHaveBeenCalledWith(); expect(onDeepScan).toHaveBeenCalledTimes(1);
});

test('initial scan menu has one prominent scan command and hides full verification under advanced options', () => {
  const screen = render(<LibraryScanSourceActions disabled={false} activeFolders={1}
    onImport={jest.fn()} onDeepScan={jest.fn()} />);
  expect(screen.getByText('Musikbibliothek aktualisieren')).toBeTruthy();
  expect(screen.queryByText('Vollständige Prüfung')).toBeNull();
  fireEvent.press(screen.getByText('Weitere Scanoptionen'));
  expect(screen.getByText('Vollständige Prüfung')).toBeTruthy();
});
