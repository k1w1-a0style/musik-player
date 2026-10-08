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

  expect(getByText('Schnellscan / Import')).toBeTruthy();
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

  fireEvent.press(getByText('Schnellscan / Import'));
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

  expect(getByTestId('library-menu-item-schnellscan-import').props.accessibilityState.disabled).toBe(true);
  expect(getByLabelText('Ordner hinzufügen').props.accessibilityState.disabled).toBe(true);
});

test('allows the combined scan in an empty library', () => {
  const { getByTestId } = renderMenu({ hasSongs: false });
  expect(getByTestId('library-menu-item-schnellscan-import').props.accessibilityState.disabled).toBe(false);
});

test('keeps one scan action even after a legacy metadata refresh was resumable', () => {
  const { getByText, queryByText } = renderMenu({ canResumeRefresh: true });
  expect(getByText('Schnellscan / Import')).toBeTruthy();
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
  expect(screen.getByText('Neue oder geänderte Dateien einlesen.')).toBeTruthy();
  expect(screen.getByLabelText('Vollständiger Scan').props.accessibilityHint).toBe('Alle Dateien und ihren Inhalt erneut prüfen.');
  fireEvent.press(screen.getByText('Vollständiger Scan'));
  expect(onDeepScan).toHaveBeenCalledTimes(1);
  screen.rerender(<LibraryMenuModal {...defaultProps} loading onDeepScan={onDeepScan} />);
  expect(screen.getByLabelText('Vollständiger Scan').props.accessibilityState.disabled).toBe(true);
});


test('uses app theme chrome for the menu card', () => {
  const { getByTestId } = renderMenu();
  const styleText = JSON.stringify(getByTestId('library-menu-card').props.style);

  expect(styleText).toContain(mockAppTheme.palette.surfaceElevated);
  expect(styleText).toContain(mockAppTheme.palette.border);
});

test('renders menu icon slots and section divider', () => {
  const { getByTestId } = renderMenu();

  expect(getByTestId('library-menu-item-icon-schnellscan-import')).toBeTruthy();
  expect(getByTestId('library-menu-item-icon-equalizer')).toBeTruthy();
  expect(JSON.stringify(getByTestId('library-menu-section-divider').props.style)).toContain(mockAppTheme.palette.border);
});
