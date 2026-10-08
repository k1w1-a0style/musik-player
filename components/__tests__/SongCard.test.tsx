import React from 'react';
import * as ReactNative from 'react-native';
import { Image, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import SongCard from '../SongCard';
import { useArtworkThumbnail } from '../../hooks/useArtworkThumbnail';
import { getLibrarySongItemLayout } from '../../utils/libraryRendererHelpers';
import { KIWI_MUSIC_ARTWORK } from '../../utils/songArtwork';

jest.mock('../../hooks/useArtworkThumbnail', () => ({ useArtworkThumbnail: jest.fn((uri: string | undefined) => uri) }));

// These layout/cover tests render already prepared library entries.
jest.mock('../../hooks/useSongPreparation', () => ({ useSongPreparation: () => 'ready' }));

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    primary: '#D8DEE8',
    primaryGlow: 'rgba(216, 222, 232, 0.12)',
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

jest.mock('expo-system-audio', () => ({
  extractEmbeddedArtwork: jest.fn(),
}));

describe('SongCard', () => {
  const song = { id: '1', title: 'Track', artist: 'Artist', cover: 'file:///broken.jpg' };

  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(UNSAFE_getByType(Image).props.source).toBe(KIWI_MUSIC_ARTWORK);
  });

  test('calls stable song press handler with the row song', () => {
    const onPressSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-1'));

    expect(onPressSong).toHaveBeenCalledWith(song);
  });

  test('calls info handler with song', () => {
    const onInfoSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-info-1'));

    expect(onInfoSong).toHaveBeenCalledWith(song);
  });

  test('pressing info does not trigger song press', () => {
    const onPressSong = jest.fn();
    const onInfoSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={onPressSong} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-info-1'));

    expect(onInfoSong).toHaveBeenCalledWith(song);
    expect(onPressSong).not.toHaveBeenCalled();
  });

  test('marks current song as selected for accessibility', () => {
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent isPlaying={false} />,
    );

    expect(getByTestId('song-card-1').props.accessibilityState?.selected).toBe(true);
  });

  test('does not mark non-current song as selected for accessibility', () => {
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    expect(getByTestId('song-card-1').props.accessibilityState?.selected).not.toBe(true);
  });

  test('uses app theme row chrome and text colors', () => {
    const { getByTestId, getByText } = render(
      <SongCard song={{ id: 'themed', title: 'Themed Track', artist: 'Theme Artist' }} onPressSong={jest.fn()} onInfoSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    expect(JSON.stringify(getByTestId('song-card-themed').props.style)).toContain(mockAppTheme.palette.border);
    expect(JSON.stringify(getByTestId('song-card-cover-themed').props.style)).toContain(mockAppTheme.palette.surfaceGlass);
    expect(JSON.stringify(getByTestId('song-card-cover-themed').props.style)).toContain(mockAppTheme.palette.border);
    expect(JSON.stringify(getByText('Themed Track').props.style)).toContain(mockAppTheme.palette.text.primary);
    expect(JSON.stringify(getByText('Theme Artist').props.style)).toContain(mockAppTheme.palette.text.secondary);
  });

  test('uses app theme selected chrome', () => {
    const { getByTestId } = render(
      <SongCard song={{ id: 'current', title: 'Current Track', artist: 'Theme Artist' }} onPressSong={jest.fn()} isCurrent isPlaying />,
    );

    expect(JSON.stringify(getByTestId('song-card-current').props.style)).toContain(mockAppTheme.palette.primaryGlow);
  });

  test('shows compact duration and format metadata on row cards', () => {
    const { getByTestId } = render(
      <SongCard
        song={{ id: 'meta-row', title: 'Meta Track', artist: 'Artist', duration: 185_000, fileInfo: { extension: 'mp3' } }}
        onPressSong={jest.fn()}
        isCurrent={false}
        isPlaying={false}
      />,
    );

    const metadata = getByTestId('song-card-meta-meta-row');
    expect(metadata.props.children).toBe('3:05 • MP3');
    expect(JSON.stringify(metadata.props.style)).toContain(mockAppTheme.palette.text.muted);
  });

  test('shows compact metadata on tile cards', () => {
    const { getByTestId } = render(
      <SongCard
        song={{ id: 'meta-tile', title: 'Tile Track', artist: 'Artist', audioInfo: { durationMs: 62_000 }, fileInfo: { mimeType: 'audio/flac' } }}
        onPressSong={jest.fn()}
        isCurrent={false}
        isPlaying={false}
        variant="tile"
      />,
    );

    expect(getByTestId('song-card-meta-meta-tile').props.children).toBe('1:02 • FLAC');
  });

  test('updates a row when only its bitrate is backfilled', () => {
    const onPressSong = jest.fn();
    const base = { id: 'bitrate', title: 'Track', artist: 'Artist', fileInfo: { extension: 'mp3' } };
    const view = render(<SongCard song={base} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
    view.rerender(<SongCard song={{ ...base, audioInfo: { bitrate: 320 } }}
      onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
    expect(view.getByTestId('song-card-meta-bitrate').props.children).toBe('MP3 • 320 kbps');
  });

  test('omits metadata row when no duration or format is available', () => {
    const { queryByTestId } = render(
      <SongCard song={{ id: 'plain', title: 'Plain Track', artist: 'Artist' }} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    expect(queryByTestId('song-card-meta-plain')).toBeNull();
  });
});

test('does not trigger native embedded-artwork extraction from rows', () => {
  render(
    <>
      <SongCard song={{ id: 'a', title: 'A', artist: 'Artist', uri: 'file:///a.mp3' }} onPressSong={jest.fn()} isCurrent isPlaying={false} />
      <SongCard song={{ id: 'b', title: 'B', artist: 'Artist', uri: 'file:///b.mp3' }} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />
    </>,
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
});

test('keeps card heights and FlatList offsets aligned at large system fonts', () => {
  const dimensions = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    width: 320, height: 640, scale: 2, fontScale: 2,
  });
  const row = { id: 'large', title: 'Sehr langer Titel', artist: 'Łódź', duration: 60_000 };
  const view = render(<SongCard song={row} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  const cardHeight = StyleSheet.flatten(view.getByTestId('song-card-slot-large').props.style).height;
  expect(cardHeight).toBeGreaterThanOrEqual(51 * 2 + 18);
  expect(getLibrarySongItemLayout(null, 2, 2)).toEqual({ length: Number(cardHeight) + 6,
    offset: (Number(cardHeight) + 6) * 2, index: 2 });
  view.rerender(<SongCard song={row} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} variant="banner" />);
  expect(StyleSheet.flatten(view.getByTestId('song-card-slot-large').props.style).height).toBeGreaterThanOrEqual(55 * 2 + 18);
  dimensions.mockRestore();
});

test('refreshes full-song action payloads after invisible tag edits', () => {
  const onPressSong = jest.fn();
  const onInfoSong = jest.fn();
  const row = { id: 'tags', title: 'Track', artist: 'Artist', genre: 'Techno', comment: 'Old' };
  const view = render(<SongCard song={row} onPressSong={onPressSong} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />);
  const edited = { ...row, genre: 'Hard Techno', comment: 'New', audioInfo: { sampleRate: 48000 } };
  view.rerender(<SongCard song={edited} onPressSong={onPressSong} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />);
  fireEvent.press(view.getByTestId('song-card-tags'));
  fireEvent.press(view.getByTestId('song-card-info-tags'));
  expect(onPressSong).toHaveBeenLastCalledWith(edited);
  expect(onInfoSong).toHaveBeenLastCalledWith(edited);
});

test('retries the original cover after a derived thumbnail fails', () => {
  jest.mocked(useArtworkThumbnail).mockReturnValue('file:///thumbnail.jpg');
  const row = { id: 'thumbnail', title: 'Track', artist: 'Artist', cover: 'file:///original.jpg' };
  const view = render(<SongCard song={row} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
  expect(view.UNSAFE_getByType(Image).props.source.uri).toBe('file:///thumbnail.jpg');
  fireEvent(view.UNSAFE_getByType(Image), 'error');
  expect(view.UNSAFE_getByType(Image).props.source.uri).toBe('file:///original.jpg');
  fireEvent(view.UNSAFE_getByType(Image), 'error');
  expect(view.UNSAFE_getByType(Image).props.source).toBe(KIWI_MUSIC_ARTWORK);
  jest.mocked(useArtworkThumbnail).mockImplementation(uri => uri);
});
