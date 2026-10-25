import React from 'react';

const mockAppTheme = {
  palette: {
    backgroundDeep: '#030406',
    surfaceElevated: '#191B21',
    border: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
      muted: 'rgba(244, 245, 247, 0.42)',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import LibraryMenuModal from '../LibraryMenuModal';

const defaultProps = {
  visible: true,
  loading: false,
  isReady: true,
  hasSongs: true,
  activeFolders: 2,
  canResumeRefresh: false,
  onClose: jest.fn(),
  onImport: jest.fn(),
  onRefreshMetadata: jest.fn(),
  onAddFolder: jest.fn(),
  onShowFolders: jest.fn(),
  onOpenSettings: jest.fn(),
  onOpenEqualizer: jest.fn(),
};

const renderMenu = (patch: Partial<typeof defaultProps> = {}) => render(<LibraryMenuModal {...defaultProps} {...patch} />);

test('renders menu actions', () => {
  const { getByText, queryByText } = renderMenu();

  expect(getByText('Musikbibliothek aktualisieren')).toBeTruthy();
  expect(queryByText('Metadaten aktualisieren')).toBeNull();
  expect(getByText('Ordner hinzufügen')).toBeTruthy();
  expect(getByText('Aktive Scan-Ordner: 2')).toBeTruthy();
  expect(getByText('Equalizer')).toBeTruthy();
  expect(getByText('Einstellungen')).toBeTruthy();
});

test('calls menu action callbacks', () => {
  const onImport = jest.fn();
  const onRefreshMetadata = jest.fn();
  const onAddFolder = jest.fn();
  const onShowFolders = jest.fn();
  const onOpenSettings = jest.fn();
  const onOpenEqualizer = jest.fn();
  const { getByText } = renderMenu({ onImport, onRefreshMetadata, onAddFolder, onShowFolders, onOpenSettings, onOpenEqualizer });

  fireEvent.press(getByText('Musikbibliothek aktualisieren'));
  expect(onImport).not.toHaveBeenCalled();
  fireEvent.press(getByText('Android-Musikbibliothek'));
  expect(onImport).toHaveBeenCalledWith({ source: 'media-library' });
  fireEvent.press(getByText('Ordner hinzufügen'));
  fireEvent.press(getByText('Aktive Scan-Ordner: 2'));
  fireEvent.press(getByText('Equalizer'));
  fireEvent.press(getByText('Einstellungen'));

  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onRefreshMetadata).not.toHaveBeenCalled();
  expect(onAddFolder).toHaveBeenCalledTimes(1);
  expect(onShowFolders).toHaveBeenCalledTimes(1);
  expect(onOpenEqualizer).toHaveBeenCalledTimes(1);
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

test('disables import and adding folders while loading', () => {
  const { getByTestId, getByLabelText } = renderMenu({ loading: true });

  expect(getByTestId('library-menu-item-musikbibliothek-aktualisieren').props.accessibilityState.disabled).toBe(true);
  expect(getByLabelText('Ordner hinzufügen').props.accessibilityState.disabled).toBe(true);
});

test('allows the combined scan in an empty library', () => {
  const { getByTestId } = renderMenu({ hasSongs: false });
  expect(getByTestId('library-menu-item-musikbibliothek-aktualisieren').props.accessibilityState.disabled).toBe(false);
});

test('keeps one scan action even after a legacy metadata refresh was resumable', () => {
  const { getByText, queryByText } = renderMenu({ canResumeRefresh: true });
  expect(getByText('Musikbibliothek aktualisieren')).toBeTruthy();
  expect(queryByText('Metadaten-Update fortsetzen')).toBeNull();
  expect(queryByText('Metadaten aktualisieren')).toBeNull();
});

test('calls onClose when backdrop is pressed', () => {
  const onClose = jest.fn();
  const { getByTestId } = renderMenu({ onClose });

  fireEvent.press(getByTestId('library-menu-backdrop'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('offers and disables the explicit full scan alongside the normal import', () => {
  const onDeepScan = jest.fn();
  const screen = render(<LibraryMenuModal {...defaultProps} onDeepScan={onDeepScan} />);
  expect(screen.getByText('Quelle wählen und neue oder geänderte Titel einlesen.')).toBeTruthy();
  expect(screen.queryByText('Vollständige Prüfung')).toBeNull();
  fireEvent.press(screen.getByLabelText('Weitere Scanoptionen'));
  expect(screen.getByLabelText('Vollständige Prüfung').props.accessibilityHint).toBe('Nur bei Problemen: bereits bekannte Dateien und Inhalte erneut überprüfen.');
  fireEvent.press(screen.getByText('Vollständige Prüfung'));
  expect(onDeepScan).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Beide Quellen'));
  expect(onDeepScan).toHaveBeenCalledWith({ source: 'both' });
  expect(onDeepScan).toHaveBeenCalledTimes(1);
  screen.rerender(<LibraryMenuModal {...defaultProps} loading onDeepScan={onDeepScan} />);
  expect(screen.getByLabelText('Weitere Scanoptionen').props.accessibilityState.disabled).toBe(true);
});


test('uses app theme chrome for the menu card', () => {
  const { getByTestId } = renderMenu();
  const styleText = JSON.stringify(getByTestId('library-menu-card').props.style);

  expect(styleText).toContain(mockAppTheme.palette.surfaceElevated);
  expect(styleText).toContain(mockAppTheme.palette.border);
});

test('renders menu icon slots and section divider', () => {
  const { getByTestId } = renderMenu();

  expect(getByTestId('library-menu-item-icon-musikbibliothek-aktualisieren')).toBeTruthy();
  expect(getByTestId('library-menu-item-icon-equalizer')).toBeTruthy();
  expect(JSON.stringify(getByTestId('library-menu-section-divider').props.style)).toContain(mockAppTheme.palette.border);
});

test.each([
  { height: 640, top: 24, bottom: 48 },
  { height: 480, top: 40, bottom: 24 },
  { height: 800, top: 0, bottom: 0 },
])('keeps the scrollable menu above system navigation at height $height', ({ height, top, bottom }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Isolate the platform viewport boundary.
  const native = require('react-native') as typeof import('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SafeAreaInsetsContext } = require('react-native-safe-area-context') as typeof import('react-native-safe-area-context');
  const dimensions = jest.spyOn(native, 'useWindowDimensions').mockReturnValue({ width: 320, height, scale: 1.5, fontScale: 2 });
  try {
    const view = render(<SafeAreaInsetsContext.Provider value={{ top, bottom, left: 0, right: 0 }}>
      <LibraryMenuModal {...defaultProps} />
    </SafeAreaInsetsContext.Provider>);
    const backdrop = native.StyleSheet.flatten(view.getByTestId('library-menu-backdrop').props.style);
    const card = native.StyleSheet.flatten(view.getByTestId('library-menu-card').props.style);
    const scroll = native.StyleSheet.flatten(view.UNSAFE_getByType(native.ScrollView).props.style);
    const menuBottom = Number(backdrop.paddingTop) + 2 * Number(card.paddingVertical) + 2 * Number(card.borderWidth) + Number(scroll.maxHeight);
    expect(menuBottom).toBeLessThanOrEqual(height - bottom - 12);
    expect(Number(scroll.maxHeight)).toBeGreaterThanOrEqual(48);
  } finally { dimensions.mockRestore(); }
});
