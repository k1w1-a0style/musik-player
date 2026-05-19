import React from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useTrackInfoScreenState } from '../useTrackInfoScreenState';
import { APP_STACK_ROUTES } from '../../types/routes';

let mockRouteSongId = 's1';
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetSongs = jest.fn();

const mockSongs = [
  {
    id: 's1',
    title: 'One',
    artist: 'A',
    cover: 'file:///fallback.jpg',
    coverInfo: { status: 'cached', uri: 'file:///cached.jpg' },
    fileInfo: { importedAt: '2024-01-02T03:04:05.000Z' },
  },
  { id: 's2', title: 'Two', artist: 'B' },
];

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockRouteSongId } }),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({ songs: mockSongs, setSongs: mockSetSongs }),
}));

const TrackInfoStateProbe = () => {
  const state = useTrackInfoScreenState();

  return (
    <>
      <Text testID="song-id">{state.song?.id ?? 'missing'}</Text>
      <Text testID="cover-uri">{state.coverUri ?? 'none'}</Text>
      <Text testID="cover-status">{state.coverStatus}</Text>
      <Text testID="imported-at">{state.importedAt}</Text>
      <Text testID="cover-failed">{String(state.coverFailed)}</Text>
      <Pressable testID="fail-cover" onPress={() => state.setCoverFailed(true)} />
      <Pressable testID="open-editor" onPress={state.openTagEditor} />
      <Pressable testID="remove" onPress={state.removeFromLibrary} />
    </>
  );
};

describe('useTrackInfoScreenState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteSongId = 's1';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('builds selected song state', () => {
    const { getByTestId } = render(<TrackInfoStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('s1');
    expect(getByTestId('cover-uri').props.children).toBe('file:///cached.jpg');
    expect(getByTestId('cover-status').props.children).toBe('cached');
    expect(getByTestId('imported-at').props.children).toContain('2024');
  });

  test('resets missing song state', () => {
    mockRouteSongId = '404';
    const { getByTestId } = render(<TrackInfoStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('missing');
    expect(getByTestId('cover-uri').props.children).toBe('none');
    expect(getByTestId('cover-status').props.children).toBe('none');
    expect(getByTestId('imported-at').props.children).toBe('Nicht verfügbar');
  });

  test('navigates to tag editor', () => {
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('open-editor'));

    expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TAG_EDITOR, { songId: 's1' });
  });

  test('opens remove confirmation and removes song on confirm', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[1]?.onPress?.();
    });
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('remove'));

    expect(mockSetSongs).toHaveBeenCalledWith([mockSongs[1]]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('ignores actions without a selected song', () => {
    mockRouteSongId = '404';
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('open-editor'));
    fireEvent.press(getByTestId('remove'));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSetSongs).not.toHaveBeenCalled();
  });
});
