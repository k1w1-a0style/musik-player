import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TagEditor, { buildDraftFromDirtyFields, hasRemovableCover } from '../TagEditor';
const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: jest.fn(),
  setSkin: jest.fn(),
  theme: {
    id: 'graphite-dark',
    appearance: 'dark',
    skin: 'graphite',
    label: 'Graphite Dark',
    navigationDark: true,
    statusBarStyle: 'light-content',
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      surfaceGlass: 'rgba(18, 20, 26, 0.76)',
      card: '#111318',
      cardElevated: '#1A1D24',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      primaryGlow: 'rgba(216, 222, 232, 0.12)',
      accent: '#BFC7D4',
      accentGlow: 'rgba(191, 199, 212, 0.10)',
      success: '#D8DEE8',
      error: '#FF6F8A',
      warning: '#FFCA77',
      text: {
        primary: '#F4F5F7',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

const mockWriteTagsToFile = jest.fn();
const mockUpdateSongMetadata = jest.fn();
const mockRefreshSongsFromId3 = jest.fn();
let mockSongId = 's1';
let mockSongs: any[] = [];
let mockCapability = {
  canRead: true,
  canWrite: true,
  uriType: 'file',
  reason: 'ok',
  supportedContainer: 'mp3',
};
let mockPlan = { blockingReasons: [] as string[] };
let mockTagEditorStateCrash = false;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockSongId } }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));


jest.mock('../../utils/songMetadataRefresh', () => ({
  refreshSongsFromId3: (...args: unknown[]) => mockRefreshSongsFromId3(...args),
}));
jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => {
    if (mockTagEditorStateCrash) throw new Error('tag editor screen state crash');

    return {
      songs: mockSongs,
      updateSongMetadata: mockUpdateSongMetadata,
    };
  },
}));
jest.mock(
  '../../components/AppBackground',
  () =>
    ({ children }: any) =>
      children,
);
jest.mock(
  '../../components/Screen',
  () =>
    ({ children }: any) =>
      children,
);
jest.mock('../../utils/tagEditCapability', () => ({
  getTagEditCapability: () => mockCapability,
}));
jest.mock('../../utils/tagWriteOrchestrator', () => ({
  createTagWriteOperationPlan: () => mockPlan,
}));
jest.mock('../../utils/tagWriter', () => {
  class TagWriterError extends Error {
    constructor(code: string, message: string) {
      super(message);
      (this as any).code = code;
    }
  }
  return {
    writeTagsToFile: (...args: any[]) => mockWriteTagsToFile(...args),
    TagWriterError,
  };
});

beforeEach(() => {
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_t, _m, buttons: any) => buttons?.[1]?.onPress?.());
  mockCapability = {
    canRead: true,
    canWrite: true,
    uriType: 'file',
    reason: 'ok',
    supportedContainer: 'mp3',
  };
  mockPlan = { blockingReasons: [] };
  mockTagEditorStateCrash = false;
  mockSongs = [
    {
      id: 's1',
      title: 'A',
      artist: 'B',
      album: 'C',
      uri: 'file:///x.mp3',
      year: '2020',
      genre: 'Pop',
      trackNumber: '2/9',
      discNumber: '1/1',
      comment: 'Start',
      cover: 'file:///cover.jpg',
      coverInfo: { status: 'external', uri: 'file:///cover.jpg' },
      fileInfo: { extension: 'mp3', uri: 'file:///x.mp3' },
    },
  ];
  mockWriteTagsToFile.mockReset();
  mockUpdateSongMetadata.mockReset();
  mockRefreshSongsFromId3.mockReset();
  mockRefreshSongsFromId3.mockImplementation(async ([song]: any[]) => {
    const draft = mockWriteTagsToFile.mock.calls.at(-1)?.[1] ?? { tags: {} };
    const normalizedTags = Object.fromEntries(Object.entries(draft.tags ?? {}).map(([key, value]) => [key, typeof value === 'string' && value.trim() ? value.trim() : undefined]));
    const next = { ...song, ...normalizedTags };
    if (draft.removeCover) { next.cover = undefined; next.coverInfo = undefined; }
    if (draft.cover) { next.cover = 'file:///verified-cover.jpg'; next.coverInfo = { status: 'embedded', uri: 'file:///verified-cover.jpg', embeddedArtworkChecked: true }; }
    return { songs: [next], updated: 1, skipped: 0, failed: 0, errors: [], patchesBySongId: { [song.id]: normalizedTags }, processed: 1, total: 1, completed: true };
  });
});

test('renders the screen fallback when the inner screen-state component throws', () => {
  mockTagEditorStateCrash = true;
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  const view = render(<TagEditor />);

  expect(view.getByTestId('tag-editor-error-boundary-fallback')).toBeTruthy();
  expect(view.getByText('Bereich konnte nicht geladen werden.')).toBeTruthy();
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    '[TagEditor] ErrorBoundary caught an error',
    expect.any(Error),
    expect.objectContaining({ componentStack: expect.any(String) }),
  );

  consoleErrorSpy.mockRestore();
  view.unmount();
});

test('renders fields with current song', () => {
  const { getByDisplayValue } = render(<TagEditor />);
  expect(getByDisplayValue('A')).toBeTruthy();
  expect(getByDisplayValue('B')).toBeTruthy();
  expect(getByDisplayValue('C')).toBeTruthy();
  expect(getByDisplayValue('2/9')).toBeTruthy();
  expect(getByDisplayValue('1/1')).toBeTruthy();
  expect(getByDisplayValue('Start')).toBeTruthy();
});

test('not found state', () => {
  mockSongId = '404';
  const { getByText } = render(<TagEditor />);
  expect(getByText('Titel nicht gefunden.')).toBeTruthy();
  mockSongId = 's1';
});

test('canWrite false blocks save and shows reason', () => {
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'content',
    reason:
      'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.',
    supportedContainer: 'mp3',
  };
  const { getByText, getByTestId } = render(<TagEditor />);
  expect(getByText(/content:\/\//)).toBeTruthy();
  fireEvent.press(getByTestId('save-button'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('fields are read-only when canWrite is false', () => {
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'content',
    reason:
      'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.',
    supportedContainer: 'mp3',
  };
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('input-title').props.editable).toBe(false);
});

test('shows blocking reason from write plan', () => {
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'file',
    reason: 'blocked',
    supportedContainer: 'unsupported',
  };
  mockPlan = { blockingReasons: ['UnsupportedFormat'] };
  const { getByText } = render(<TagEditor />);
  expect(getByText('Format nicht unterstützt.')).toBeTruthy();
});

test('shows FileTooLarge blocking reason from write plan', () => {
  mockPlan = { blockingReasons: ['FileTooLarge'] };
  const { getByText } = render(<TagEditor />);
  expect(getByText('Datei ist zu groß für sicheres In-App-Tag-Schreiben.')).toBeTruthy();
});

test('shows guarded file write safety notice', () => {
  const { getByText } = render(<TagEditor />);
  expect(getByText(/Backup \+ Temp \+ Byteprüfung/)).toBeTruthy();
  expect(getByText(/nicht OS-atomar/)).toBeTruthy();
});

test('shows MP4 limited-layout safety notice', () => {
  mockSongs = [
    {
      ...mockSongs[0],
      uri: 'file:///x.m4a',
      fileInfo: { extension: 'm4a', uri: 'file:///x.m4a' },
    },
  ];
  const { getByText } = render(<TagEditor />);
  expect(getByText(/MP4\/M4A wird nur für bekannte, sichere Atom-Layouts/)).toBeTruthy();
});

test('shows content URI read-only safety notice', () => {
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'content',
    reason: 'blocked',
    supportedContainer: 'mp3',
  };
  mockSongs = [
    {
      ...mockSongs[0],
      uri: 'content://x.mp3',
      fileInfo: { extension: 'mp3', uri: 'content://x.mp3' },
    },
  ];
  const { getByText } = render(<TagEditor />);
  expect(getByText(/Android-Medien- oder SAF-Quellen/)).toBeTruthy();
  expect(getByText(/System-Dateiauswahldialog/)).toBeTruthy();
});

test('unchanged form does not write', () => {
  const { getByTestId } = render(<TagEditor />);
  fireEvent.press(getByTestId('save-button'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('changed title builds draft only with title', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Neu');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags).toEqual({ title: 'Neu' });
});

test('cleared album keeps empty string in draft', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-album'), '');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags).toEqual({ album: '' });
});

test('removeCover + written clears cover fields in updateSongMetadata patch', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.press(getByTestId('remove-cover'));
  fireEvent.changeText(getByTestId('input-title'), 'With Cover Remove');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', {
      title: 'With Cover Remove',
      cover: undefined,
      coverInfo: undefined,
    }),
  );
});

test('removeCover + rolledBack does not patch metadata', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'rolledBack' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.press(getByTestId('remove-cover'));
  fireEvent.changeText(getByTestId('input-title'), 'Rolled Back');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockUpdateSongMetadata).not.toHaveBeenCalled();
});

test('removeCover + noop does not patch metadata', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'noop' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.press(getByTestId('remove-cover'));
  fireEvent.changeText(getByTestId('input-title'), 'Noop');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockUpdateSongMetadata).not.toHaveBeenCalled();
});

test('written save shows success and updates context with touched fields only', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Neu');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(getByText('Metadaten erfolgreich geschrieben.')).toBeTruthy(),
  );
  expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { title: 'Neu' });
  expect(mockUpdateSongMetadata.mock.calls[0][1].artist).toBeUndefined();
});

test('trimmed title is normalized before metadata patch', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), '  Neuer Titel  ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { title: 'Neuer Titel' }),
  );
  expect(getByTestId('input-title').props.value).toBe('Neuer Titel');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('whitespace-only album normalizes to undefined in metadata patch', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-album'), '   ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { album: undefined }),
  );
  expect(getByTestId('input-album').props.value).toBe('');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('trackNumber preserved and normalized after written', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-trackNumber'), ' 3/12 ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { trackNumber: '3/12' }),
  );
  expect(getByTestId('input-trackNumber').props.value).toBe('3/12');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('discNumber preserved and normalized after written', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-discNumber'), ' 1/2 ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { discNumber: '1/2' }),
  );
  expect(getByTestId('input-discNumber').props.value).toBe('1/2');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('comment preserved and normalized after written', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-comment'), '  Hallo  ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { comment: 'Hallo' }),
  );
  expect(getByTestId('input-comment').props.value).toBe('Hallo');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('whitespace-only comment resets to empty after written', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-comment'), '   ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { comment: undefined }),
  );
  expect(getByTestId('input-comment').props.value).toBe('');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('non-song-form fields remain visible after later title write', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-comment'), ' Erste Notiz ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(getByTestId('input-comment').props.value).toBe('Erste Notiz'),
  );

  fireEvent.changeText(getByTestId('input-title'), 'Zweiter Titel');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(getByTestId('input-title').props.value).toBe('Zweiter Titel'),
  );
  expect(getByTestId('input-comment').props.value).toBe('Erste Notiz');
});

test('noop keeps normalized trackNumber visible and disables save', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'noop' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-trackNumber'), ' 3/12 ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Keine Änderung.')).toBeTruthy());
  expect(getByTestId('input-trackNumber').props.value).toBe('3/12');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('title + removeCover applies normalized title and clears cover fields', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.press(getByTestId('remove-cover'));
  fireEvent.changeText(getByTestId('input-title'), '  Neu  ');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() =>
    expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', {
      title: 'Neu',
      cover: undefined,
      coverInfo: undefined,
    }),
  );
  expect(getByText('Cover entfernen: Nein')).toBeTruthy();
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
});

test('noop resets dirty state and disables save while keeping status', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'noop' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Noop Value');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Keine Änderung.')).toBeTruthy());
  expect(getByTestId('input-title').props.value).toBe('Noop Value');
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  expect(mockUpdateSongMetadata).not.toHaveBeenCalled();
});

test('noop and rolledBack status messages', async () => {
  mockWriteTagsToFile
    .mockResolvedValueOnce({ status: 'noop' })
    .mockResolvedValueOnce({ status: 'rolledBack' });
  const { getByTestId, getByText, rerender } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'X');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Keine Änderung.')).toBeTruthy());

  rerender(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Y');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Änderung wurde zurückgerollt.')).toBeTruthy());
  expect(getByTestId('input-title').props.value).toBe('Y');
});

test('shows mapped writer errors', async () => {
  const { TagWriterError } = jest.requireMock('../../utils/tagWriter');
  mockWriteTagsToFile.mockRejectedValue(new TagWriterError('InvalidTagData', 'bad'));
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Z');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText(/Ungültige Metadaten/)).toBeTruthy());
  expect(getByTestId('input-title').props.value).toBe('Z');
});

test('save button disabled while saving', async () => {
  let resolveFn: any;
  mockWriteTagsToFile.mockReturnValue(
    new Promise(resolve => {
      resolveFn = resolve;
    }),
  );
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Busy');
  fireEvent.press(getByTestId('save-button'));
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  resolveFn({ status: 'written' });
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
});

test('draft builder utility respects dirty fields/removeCover', () => {
  const form = {
    title: 'a',
    artist: 'b',
    albumArtist: '',
    album: '',
    year: '',
    genre: '',
    trackNumber: '',
    discNumber: '',
    comment: '',
  };
  const draft = buildDraftFromDirtyFields('id', form, { title: true, album: true }, true);
  expect(draft.tags).toEqual({ title: 'a', album: '' });
  expect(draft.removeCover).toBe(true);
});

test('content:// song disables remove but still allows preview cover picking', () => {
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'content',
    reason:
      'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.',
    supportedContainer: 'mp3',
  };
  const { getByTestId, getByText } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('pick-cover').props.accessibilityState.disabled).toBe(false);
  expect(getByText('Cover auswählen: JPG/PNG')).toBeTruthy();
});

test('android file:// writable song keeps remove-cover enabled for legacy cover without coverInfo', () => {
  mockSongs = [{ ...mockSongs[0], coverInfo: undefined }];
  mockCapability = {
    canRead: true,
    canWrite: true,
    uriType: 'file',
    reason: 'ok',
    supportedContainer: 'mp3',
  };
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(false);
});

test('save without cover change sends no cover payload', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Only Title');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1]).toEqual({
    songId: 's1',
    tags: { title: 'Only Title' },
  });
});

test('remove-cover disabled when song has no cover', () => {
  mockSongs = [{ ...mockSongs[0], cover: undefined, coverInfo: undefined }];
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(true);
});

test('remove-cover disabled for external cover info with song.cover because it is not a file cover remove', () => {
  mockSongs = [
    {
      ...mockSongs[0],
      cover: 'file:///app-cover.jpg',
      coverInfo: { status: 'external', uri: 'file:///app-cover.jpg' },
    },
  ];
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(true);
});

test('remove-cover enabled for pending replacement preview and clears pending state on save', async () => {
  mockSongs = [
    {
      ...mockSongs[0],
      cover: 'file:///picked-cover.jpg',
      coverInfo: {
        status: 'external',
        uri: 'file:///picked-cover.jpg',
        pendingEmbeddedArtworkRefresh: true,
        embeddedArtworkRefreshFailed: false,
      },
    },
  ];
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);

  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(getByTestId('remove-cover'));
  fireEvent.press(getByTestId('save-button'));

  await waitFor(() => expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', {
    cover: undefined,
    coverInfo: undefined,
  }));
});

test('remove-cover enabled for failed replacement preview', () => {
  mockSongs = [
    {
      ...mockSongs[0],
      cover: 'file:///picked-cover.jpg',
      coverInfo: {
        status: 'external',
        uri: 'file:///picked-cover.jpg',
        pendingEmbeddedArtworkRefresh: false,
        embeddedArtworkRefreshFailed: true,
      },
    },
  ];
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(false);
});

test('hasRemovableCover treats embedded/cached file cover statuses and legacy cover-only songs as removable but external/none/unknown as not removable', () => {
  expect(
    hasRemovableCover({
      id: '1',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'embedded', uri: 'file:///embedded.jpg' },
    }),
  ).toBe(true);
  expect(
    hasRemovableCover({
      id: '2',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'cached', uri: 'file:///cached.jpg' },
    }),
  ).toBe(true);
  expect(
    hasRemovableCover({
      id: '3',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'embedded' },
    }),
  ).toBe(true);
  expect(
    hasRemovableCover({
      id: '4',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'external', uri: 'file:///external.jpg' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '5',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'none' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '6',
      title: 't',
      artist: 'a',
      coverInfo: { status: 'unknown' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '7',
      title: 't',
      artist: 'a',
      cover: 'file:///external-cover.jpg',
      coverInfo: { status: 'external' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '8',
      title: 't',
      artist: 'a',
      cover: 'file:///none-cover.jpg',
      coverInfo: { status: 'none' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '9',
      title: 't',
      artist: 'a',
      cover: 'file:///unknown-cover.jpg',
      coverInfo: { status: 'unknown' },
    }),
  ).toBe(false);
  expect(
    hasRemovableCover({
      id: '10',
      title: 't',
      artist: 'a',
      cover: 'file:///legacy-cover.jpg',
    }),
  ).toBe(true);
});

test('embedded cover is removable for writable file:// and sends removeCover=true', async () => {
  mockSongs = [
    {
      ...mockSongs[0],
      uri: 'file:///embedded.mp3',
      cover: undefined,
      coverInfo: { status: 'embedded' },
    },
  ];
  mockCapability = {
    canRead: true,
    canWrite: true,
    uriType: 'file',
    reason: 'ok',
    supportedContainer: 'mp3',
  };
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId, getByText } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(getByTestId('remove-cover'));
  expect(getByText('Cover entfernen: Ja')).toBeTruthy();
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].removeCover).toBe(true);
});

test('embedded cover remains blocked for content:// songs', () => {
  mockSongs = [
    {
      ...mockSongs[0],
      uri: 'content://media/1',
      cover: undefined,
      coverInfo: { status: 'embedded' },
    },
  ];
  mockCapability = {
    canRead: true,
    canWrite: false,
    uriType: 'content',
    reason:
      'SAF/content:// Schreiben ist noch nicht unterstützt. Du kannst die Datei anzeigen, aber Tags nicht direkt speichern.',
    supportedContainer: 'mp3',
  };
  const { getByTestId, getByText } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  expect(getByText(/content:\/\//)).toBeTruthy();
  fireEvent.press(getByTestId('save-button'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('cached coverInfo uri without song.cover remains removable', () => {
  mockSongs = [
    {
      ...mockSongs[0],
      cover: undefined,
      coverInfo: { status: 'cached', uri: 'file:///cached-cover.jpg' },
    },
  ];
  const { getByTestId } = render(<TagEditor />);
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(false);
});
