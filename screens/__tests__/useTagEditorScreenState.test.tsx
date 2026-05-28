import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useTagEditorScreenState } from '../useTagEditorScreenState';
import type { Song } from '../../types/Song';

let mockSongId = 's1';
const mockGoBack = jest.fn();
const mockUpdateSongMetadata = jest.fn();
const mockWriteTagsToFile = jest.fn();
const mockPickTagEditorCover = jest.fn();

const baseSongs: Song[] = [
  {
    id: 's1',
    title: 'Old Title',
    artist: 'Artist',
    uri: 'file:///song.mp3',
    fileInfo: { extension: 'mp3', uri: 'file:///song.mp3' },
    cover: 'file:///cover.jpg',
    coverInfo: { status: 'external', uri: 'file:///cover.jpg' },
  },
];
let mockSongs: Song[] = [...baseSongs];

const mockCapability = {
  canRead: true,
  canWrite: true,
  uriType: 'file',
  supportedContainer: 'mp3',
  reason: 'ok',
};

const mockPlan = {
  blockingReasons: [],
};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockSongId } }),
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    songs: mockSongs,
    updateSongMetadata: mockUpdateSongMetadata,
  }),
}));

jest.mock('../../utils/tagEditCapability', () => ({
  getTagEditCapability: () => mockCapability,
}));

jest.mock('../../utils/tagWriteOrchestrator', () => ({
  createTagWriteOperationPlan: () => mockPlan,
}));

jest.mock('../../utils/tagWriter', () => {
  class TagWriterError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    writeTagsToFile: (...args: unknown[]) => mockWriteTagsToFile(...args),
    TagWriterError,
  };
});

jest.mock('../tagEditorCoverPicker', () => ({
  pickTagEditorCover: () => mockPickTagEditorCover(),
}));

const TagEditorStateProbe = () => {
  const state = useTagEditorScreenState();

  return (
    <>
      <Text testID="song-id">{state.song?.id ?? 'missing'}</Text>
      <Text testID="title">{state.form.title}</Text>
      <Text testID="can-save">{String(state.canSave)}</Text>
      <Text testID="remove-cover">{String(state.removeCover)}</Text>
      <Text testID="replacement-cover">{state.replacementCover?.uri ?? 'none'}</Text>
      <Text testID="status">{state.status ?? 'none'}</Text>
      <Pressable testID="change-title" onPress={() => state.handleChangeField('title', '  New Title  ')} />
      <Pressable testID="toggle-remove-cover" onPress={state.toggleRemoveCover} />
      <Pressable testID="pick-cover" onPress={() => { void state.handlePickCover(); }} />
      <Pressable testID="save" onPress={() => { void state.onSaveConfirmed(); }} />
      <Pressable testID="back" onPress={state.goBack} />
    </>
  );
};

describe('useTagEditorScreenState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSongId = 's1';
    mockSongs = [...baseSongs];
    mockWriteTagsToFile.mockResolvedValue({ status: 'written', sourceUri: 'file:///song.mp3', warnings: [] });
    mockPickTagEditorCover.mockResolvedValue({
      status: 'selected',
      message: 'Neues Cover ausgewählt. Speichern schreibt es in die Datei.',
      cover: {
        uri: 'file:///new-cover.jpg',
        mimeType: 'image/jpeg',
        data: new Uint8Array([1, 2, 3]),
        sizeBytes: 3,
      },
    });
  });

  test('builds initial state for selected song', () => {
    const { getByTestId } = render(<TagEditorStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('s1');
    expect(getByTestId('title').props.children).toBe('Old Title');
    expect(getByTestId('can-save').props.children).toBe('false');
  });

  test('handles missing song state', () => {
    mockSongId = '404';
    const { getByTestId } = render(<TagEditorStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('missing');
    expect(getByTestId('can-save').props.children).toBe('false');
  });

  test('updates dirty form state and saves metadata', async () => {
    const { getByTestId } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('change-title'));

    expect(getByTestId('title').props.children).toBe('  New Title  ');
    expect(getByTestId('can-save').props.children).toBe('true');

    fireEvent.press(getByTestId('save'));

    await waitFor(() =>
      expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { title: 'New Title' }),
    );
    expect(getByTestId('status').props.children).toBe('Metadaten erfolgreich geschrieben.');
  });

  test('picks replacement cover and clears remove cover', async () => {
    const { getByTestId } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('toggle-remove-cover'));
    expect(getByTestId('remove-cover').props.children).toBe('true');

    fireEvent.press(getByTestId('pick-cover'));

    await waitFor(() => expect(getByTestId('replacement-cover').props.children).toBe('file:///new-cover.jpg'));
    expect(getByTestId('remove-cover').props.children).toBe('false');
    expect(getByTestId('status').props.children).toBe('Neues Cover ausgewählt. Speichern schreibt es in die Datei.');
  });


  test('does not update metadata when tag write returns a controlled failure', async () => {
    mockWriteTagsToFile.mockResolvedValue({
      status: 'writeFailed',
      sourceUri: 'file:///song.mp3',
      warnings: [],
      errorCode: 'TempWriteFailed',
      errorMessage: 'Temp file write failed.',
    });
    const { getByTestId } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('change-title'));
    fireEvent.press(getByTestId('save'));

    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('Temporäre Datei konnte nicht geschrieben werden.'),
    );
    expect(mockUpdateSongMetadata).not.toHaveBeenCalled();
  });

  test('does not change cover on picker permission denial or cancel', async () => {
    mockPickTagEditorCover.mockResolvedValueOnce({
      status: 'permissionDenied',
      message: 'Zugriff auf Fotos wurde verweigert. Bitte Berechtigung in den Systemeinstellungen erlauben.',
    });
    const { getByTestId } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('pick-cover'));

    await waitFor(() => expect(getByTestId('replacement-cover').props.children).toBe('none'));
    expect(getByTestId('status').props.children).toBe(
      'Zugriff auf Fotos wurde verweigert. Bitte Berechtigung in den Systemeinstellungen erlauben.',
    );

    mockPickTagEditorCover.mockResolvedValueOnce({
      status: 'cancelled',
      message: 'Cover-Auswahl abgebrochen.',
    });
    fireEvent.press(getByTestId('pick-cover'));

    await waitFor(() => expect(getByTestId('status').props.children).toBe('Cover-Auswahl abgebrochen.'));
    expect(getByTestId('replacement-cover').props.children).toBe('none');
  });

  test('ignores stale cover picker result after switching songs', async () => {
    let resolvePick: (value: {
      status: 'selected';
      message: string;
      cover: {
        uri: string;
        mimeType: 'image/jpeg';
        data: Uint8Array;
        sizeBytes: number;
      };
    }) => void = () => {};
    mockPickTagEditorCover.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolvePick = resolve;
        }),
    );
    mockSongs = [
      ...baseSongs,
      {
        id: 's2',
        title: 'Second Song',
        artist: 'Artist',
        uri: 'file:///song-2.mp3',
        fileInfo: { extension: 'mp3', uri: 'file:///song-2.mp3' },
      },
    ];
    const { getByTestId, rerender } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('pick-cover'));
    mockSongId = 's2';
    rerender(<TagEditorStateProbe />);
    resolvePick({
      status: 'selected',
      message: 'Neues Cover ausgewählt. Speichern schreibt es in die Datei.',
      cover: {
        uri: 'file:///stale-cover.jpg',
        mimeType: 'image/jpeg',
        data: new Uint8Array([4, 5, 6]),
        sizeBytes: 3,
      },
    });

    await waitFor(() => expect(getByTestId('song-id').props.children).toBe('s2'));
    expect(getByTestId('replacement-cover').props.children).toBe('none');
  });

  test('navigates back', () => {
    const { getByTestId } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('back'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('resets form and status when switching to a different song', async () => {
    mockSongs = [
      ...baseSongs,
      {
        id: 's2',
        title: 'Second Song',
        artist: 'Artist',
        uri: 'file:///song-2.mp3',
        fileInfo: { extension: 'mp3', uri: 'file:///song-2.mp3' },
      },
    ];
    const { getByTestId, rerender } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('change-title'));
    fireEvent.press(getByTestId('save'));
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('Metadaten erfolgreich geschrieben.'),
    );

    mockSongId = 's2';
    rerender(<TagEditorStateProbe />);

    await waitFor(() => {
      expect(getByTestId('song-id').props.children).toBe('s2');
      expect(getByTestId('title').props.children).toBe('Second Song');
      expect(getByTestId('status').props.children).toBe('none');
    });
  });

  test('keeps success status when same song reference updates after metadata save', async () => {
    const { getByTestId, rerender } = render(<TagEditorStateProbe />);

    fireEvent.press(getByTestId('change-title'));
    fireEvent.press(getByTestId('save'));
    await waitFor(() =>
      expect(getByTestId('status').props.children).toBe('Metadaten erfolgreich geschrieben.'),
    );

    mockSongs = [
      {
        ...mockSongs[0],
        title: 'New Title',
      },
    ];
    rerender(<TagEditorStateProbe />);

    await waitFor(() => {
      expect(getByTestId('song-id').props.children).toBe('s1');
      expect(getByTestId('status').props.children).toBe('Metadaten erfolgreich geschrieben.');
    });
  });
});
