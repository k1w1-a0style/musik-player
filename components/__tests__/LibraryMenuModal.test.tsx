import React from 'react';
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
  const { getByText } = renderMenu();

  expect(getByText('Importieren / Rescan')).toBeTruthy();
  expect(getByText('Metadaten aktualisieren')).toBeTruthy();
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

  fireEvent.press(getByText('Importieren / Rescan'));
  fireEvent.press(getByText('Metadaten aktualisieren'));
  fireEvent.press(getByText('Ordner hinzufügen'));
  fireEvent.press(getByText('Aktive Scan-Ordner: 2'));
  fireEvent.press(getByText('Equalizer'));
  fireEvent.press(getByText('Einstellungen'));

  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onRefreshMetadata).toHaveBeenCalledTimes(1);
  expect(onAddFolder).toHaveBeenCalledTimes(1);
  expect(onShowFolders).toHaveBeenCalledTimes(1);
  expect(onOpenEqualizer).toHaveBeenCalledTimes(1);
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

test('disables import and metadata actions while loading', () => {
  const { getByTestId } = renderMenu({ loading: true });

  expect(getByTestId('library-menu-item-importieren-rescan').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('library-menu-item-metadaten-aktualisieren').props.accessibilityState.disabled).toBe(true);
});

test('disables metadata action without songs', () => {
  const { getByTestId } = renderMenu({ hasSongs: false });

  expect(getByTestId('library-menu-item-metadaten-aktualisieren').props.accessibilityState.disabled).toBe(true);
});

test('renders Fortsetzen label when refresh is resumable', () => {
  const { getByText, queryByText } = renderMenu({ canResumeRefresh: true });
  expect(getByText('Metadaten-Update fortsetzen')).toBeTruthy();
  expect(queryByText('Metadaten aktualisieren')).toBeNull();
});

test('calls onClose when backdrop is pressed', () => {
  const onClose = jest.fn();
  const { getByTestId } = renderMenu({ onClose });

  fireEvent.press(getByTestId('library-menu-backdrop'));

  expect(onClose).toHaveBeenCalledTimes(1);
});
