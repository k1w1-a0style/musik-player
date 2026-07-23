import React from 'react';
import { Alert, Image, Pressable, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useTrackInfoScreenState } from '../useTrackInfoScreenState';
import { APP_STACK_ROUTES } from '../../types/routes';
import type { Song } from '../../types/Song';

let mockRouteSongId = 's1';
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetSongs = jest.fn();

const initialSongs: Song[] = [
  {
    id: 's1',
    title: 'One',
    artist: 'A',
    cover: 'file:///fallback.jpg',
    coverInfo: { status: 'cached', uri: 'file:///cached.jpg' },
    fileInfo: { importedAt: 1704164645000 },
  },
  { id: 's2', title: 'Two', artist: 'B', cover: 'file:///two.jpg' },
];

let mockSongs: Song[] = initialSongs;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockRouteSongId } }),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({ songs: mockSongs, setSongs: mockSetSongs, isReady: true }),
}));

const TrackInfoStateProbe = () => {
  const state = useTrackInfoScreenState();

  return (
    <>
      <Text testID="song-id">{state.song?.id ?? 'missing'}</Text>
      <Text testID="state-keys">{Object.keys(state).sort().join(',')}</Text>
      <Text testID="cover-uri">{state.coverUri ?? 'none'}</Text>
      <Text testID="cover-status">{state.coverStatus}</Text>
      <Text testID="cover-dimensions">{`${state.coverDimensions?.width ?? 'na'}x${state.coverDimensions?.height ?? 'na'}`}</Text>
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
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
      success(500, 500);
    });
    mockRouteSongId = 's1';
    mockSongs = initialSongs;
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

  test('finds the selected song from route params when the route changes', () => {
    const { getByTestId, rerender } = render(<TrackInfoStateProbe />);

    mockRouteSongId = 's2';
    rerender(<TrackInfoStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('s2');
    expect(getByTestId('cover-uri').props.children).toBe('file:///two.jpg');
    expect(getByTestId('cover-status').props.children).toBe('unknown');
  });

  test('resets missing song state', () => {
    mockRouteSongId = '404';
    const { getByTestId } = render(<TrackInfoStateProbe />);

    expect(getByTestId('song-id').props.children).toBe('missing');
    expect(getByTestId('cover-uri').props.children).toBe('none');
    expect(getByTestId('cover-status').props.children).toBe('none');
    expect(getByTestId('imported-at').props.children).toBe('Nicht verfügbar');
  });

  test('resets cover failure when the selected song changes', () => {
    const { getByTestId, rerender } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('fail-cover'));
    expect(getByTestId('cover-failed').props.children).toBe('true');

    mockRouteSongId = 's2';
    rerender(<TrackInfoStateProbe />);

    expect(getByTestId('cover-failed').props.children).toBe('false');
  });

  test('resets cover failure when the selected song cover changes', () => {
    const { getByTestId, rerender } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('fail-cover'));
    expect(getByTestId('cover-failed').props.children).toBe('true');

    mockSongs = [
      { ...initialSongs[0], cover: 'file:///new-fallback.jpg' },
      initialSongs[1],
    ];
    rerender(<TrackInfoStateProbe />);

    expect(getByTestId('cover-failed').props.children).toBe('false');
  });

  test('navigates to tag editor', () => {
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('open-editor'));

    expect(mockNavigate).toHaveBeenCalledWith(APP_STACK_ROUTES.TAG_EDITOR, { songId: 's1' });
  });

  test('opens remove confirmation with unchanged texts', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('remove'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Aus Bibliothek entfernen?',
      'Der Titel wird nur aus der App-Bibliothek entfernt. Die Audiodatei auf deinem Gerät bleibt erhalten.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Abbrechen', style: 'cancel' }),
        expect.objectContaining({ text: 'Entfernen', style: 'destructive' }),
      ]),
    );
  });

  test('keeps library unchanged when removal is cancelled', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    const { getByTestId } = render(<TrackInfoStateProbe />);

    fireEvent.press(getByTestId('remove'));

    expect(mockSetSongs).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('removes song from the current songs ref on confirm and goes back', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      mockSongs = [initialSongs[0], initialSongs[1], { id: 's3', title: 'Three', artist: 'C' }];
      buttons?.[1]?.onPress?.();
    });
    const { getByTestId, rerender } = render(<TrackInfoStateProbe />);

    mockSongs = [initialSongs[0], initialSongs[1], { id: 's3', title: 'Three', artist: 'C' }];
    rerender(<TrackInfoStateProbe />);
    fireEvent.press(getByTestId('remove'));

    expect(mockSetSongs).toHaveBeenCalledWith([initialSongs[1], { id: 's3', title: 'Three', artist: 'C' }]);
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

  test('keeps the public state API stable', () => {
    const { getByTestId } = render(<TrackInfoStateProbe />);

    expect(getByTestId('state-keys').props.children).toBe(
      'coverDimensions,coverFailed,coverStatus,coverUri,importedAt,isReady,openTagEditor,removeFromLibrary,setCoverFailed,song',
    );
  });
});
