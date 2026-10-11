import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import BackupPreview from '../BackupPreview';
import { getAppTheme } from '../../utils/appTheme';
import { toBackupSongReference } from '../../utils/backupMapping';
import type { MusicBackup } from '../../utils/backupFormat';
import type { Song } from '../../types/Song';
const mockTheme = getAppTheme('dark', 'graphite');
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: mockTheme }) }));
const old: Song = { id: 'old', title: 'Langer Mix für Änne', artist: 'Künstler', uri: 'file:///Old.mp3',
  fileInfo: { size: 1234, modificationTime: 1 } };
const moved: Song = { ...old, id: 'moved', uri: 'file:///New.mp3' };
const backup: MusicBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1,
  songs: [toBackupSongReference(old)], playlists: [{ id: 'p', name: 'Mix', songIds: ['old'], createdAt: 1, updatedAt: 1 }],
  favorites: ['old'], settings: { appThemeSkin: 'minimal', volume: 0.5 } };
test('preview shows missing titles and saved values; inspecting never applies data', () => {
  const restore = jest.fn();
  const screen = render(<BackupPreview backup={backup} songs={[moved]} onRestore={restore} onClose={jest.fn()} />);
  expect(screen.getByTestId('backup-match-summary').props.children.join('')).toContain('1 fehlend/übersprungen');
  fireEvent.press(screen.getByTestId('backup-settings-details'));
  expect(screen.getByText('Oberfläche: Minimal')).toBeTruthy();
  expect(screen.getByText('Lautstärke: 50 %')).toBeTruthy();
  expect(screen.getByTestId('backup-apply-settings').props.value).toBe(false);
  expect(restore).not.toHaveBeenCalled();
});
test('manual source selection is explicit; apply keeps settings opt-in and the exact preview signature', () => {
  const restore = jest.fn();
  const screen = render(<BackupPreview backup={backup} songs={[moved]} onRestore={restore} onClose={jest.fn()} />);
  fireEvent.press(screen.getByTestId('backup-reference-old'));
  expect(screen.getByTestId('backup-map-song-moved').props.accessibilityLabel).toContain('file:///New.mp3');
  fireEvent.press(screen.getByTestId('backup-map-song-moved'));
  expect(screen.getByTestId('backup-match-summary').props.children.join('')).toContain('1 zugeordnet');
  fireEvent.press(screen.getByTestId('backup-restore-apply'));
  expect(restore).toHaveBeenCalledWith(expect.objectContaining({ manual: { old: 'moved' }, applySettings: false,
    previewSources: JSON.stringify([toBackupSongReference(moved)]) }));
  fireEvent(screen.getByTestId('backup-apply-settings'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('backup-restore-apply'));
  expect(restore).toHaveBeenLastCalledWith(expect.objectContaining({ applySettings: true }));
});
test('manual skip remains visible in the summary and is passed through to restore', () => {
  const restore = jest.fn();
  const screen = render(<BackupPreview backup={backup} songs={[old]} onRestore={restore} onClose={jest.fn()} />);
  fireEvent.press(screen.getByTestId('backup-reference-old'));
  fireEvent.press(screen.getByTestId('backup-song-skip'));
  fireEvent.press(screen.getByTestId('backup-restore-apply'));
  expect(restore).toHaveBeenCalledWith(expect.objectContaining({ manual: { old: null } }));
});
