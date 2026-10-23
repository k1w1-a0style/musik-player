import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { LibraryMusicContext } from '../../contexts/musicContexts';
import type { LibraryMusicContextValue } from '../../contexts/musicContextTypes';
import PlaylistFileImportButton from '../PlaylistFileImportButton';
import PlaylistFileExportButton from '../PlaylistFileExportButton';
import { pickPlaylistFile, verifyPlaylistSources, writePlaylistFile } from '../../utils/playlistFiles';
import type { Song } from '../../types/Song';

jest.mock('../../utils/playlistFiles', () => ({ pickPlaylistFile: jest.fn(), verifyPlaylistSources: jest.fn(), writePlaylistFile: jest.fn() }));
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  border: '#333', surface: '#111', background: '#000', primary: '#fff', text: { primary: '#fff' },
} } }) }));
const songs: Song[] = [{ id: 'a', title: 'Ä', artist: 'Kiwi', uri: 'content://audio/1' }];
const save = jest.fn(() => ({ id: 'imported' }));
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <LibraryMusicContext.Provider value={{ songs, saveQueueAsPlaylist: save } as unknown as LibraryMusicContextValue}>{children}</LibraryMusicContext.Provider>;
beforeEach(() => {
  jest.clearAllMocks();
  (pickPlaylistFile as jest.Mock).mockResolvedValue({ name: 'München', songs, duplicates: 1,
    unresolved: [{ location: 'https://remote/a', line: 3, reason: 'unsupported' }] });
  (verifyPlaylistSources as jest.Mock).mockResolvedValue({ readable: songs, unreadable: [] });
  (writePlaylistFile as jest.Mock).mockResolvedValue('content://export/1');
});
test('public import action displays unresolved entries and waits for explicit confirmation', async () => {
  const view = render(<PlaylistFileImportButton />, { wrapper });
  fireEvent.press(view.getByTestId('playlist-file-import'));
  await waitFor(() => expect(view.getByText('München')).toBeTruthy());
  expect(view.getByText(/1 lokale Titel · 1 nicht zugeordnet · 1 doppelte/)).toBeTruthy();
  expect(view.getByText(/Keine unterstützte lokale Quelle/)).toBeTruthy(); expect(save).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('playlist-import-confirm'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('München', songs));
});
test('hardware-back on the preview cancels without creating a playlist', async () => {
  const view = render(<PlaylistFileImportButton />, { wrapper });
  fireEvent.press(view.getByTestId('playlist-file-import'));
  await waitFor(() => expect(view.getByText('München')).toBeTruthy());
  fireEvent.press(view.getByLabelText('Playlist-Import abbrechen'));
  expect(save).not.toHaveBeenCalled(); expect(view.queryByText('München')).toBeNull();
});
test('export invokes selected-destination service and shows success only after verified completion', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<PlaylistFileExportButton name="München" songs={songs} />);
  fireEvent.press(view.getByTestId('playlist-file-export'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Playlist exportiert', expect.any(String)));
  expect(writePlaylistFile).toHaveBeenCalledWith('München', songs); alert.mockRestore();
});
test('export warns about missing library entries before invoking the file service', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<PlaylistFileExportButton name="Mix" songs={songs} missingCount={2} />);
  fireEvent.press(view.getByTestId('playlist-file-export'));
  expect(writePlaylistFile).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  expect(alert.mock.calls[0][1]).toContain('2 Titel');
  await act(async () => { buttons[1].onPress!(); });
  expect(writePlaylistFile).toHaveBeenCalledTimes(1); alert.mockRestore();
});
test('cancelled export stays silent; failed export never reports success', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<PlaylistFileExportButton name="Mix" songs={songs} />);
  (writePlaylistFile as jest.Mock).mockResolvedValueOnce(null);
  await act(async () => fireEvent.press(view.getByTestId('playlist-file-export')));
  expect(alert).not.toHaveBeenCalled();
  (writePlaylistFile as jest.Mock).mockRejectedValueOnce(new Error('full'));
  await act(async () => fireEvent.press(view.getByTestId('playlist-file-export')));
  expect(alert).toHaveBeenCalledWith('Export fehlgeschlagen', expect.any(String)); alert.mockRestore();
});
