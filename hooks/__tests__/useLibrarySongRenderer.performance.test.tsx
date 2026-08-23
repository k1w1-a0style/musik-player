import mockReact from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useLibrarySongRenderer } from '../useLibrarySongRenderer';
import type { Song } from '../../types/Song';
import { runPlaybackUiAction } from '../../utils/playbackUiActions';

type CapturedProps = {
  song: Song;
  isCurrent: boolean;
  isPlaying: boolean;
  onPressSong: (song: Song) => void;
  onInfoSong?: (song: Song) => void;
};

const capturedProps: CapturedProps[] = [];

jest.mock('../../components/SongCard', () => (props: CapturedProps) => {
  capturedProps.push(props);
  // Return null - we only care about the props snapshot, not the rendered tree.
  return null;
});

jest.mock('../../utils/playbackUiActions', () => ({
  runPlaybackUiAction: jest.fn(async (_actionName: string, action: () => unknown) => action()),
}));

const mockedRunPlaybackUiAction = jest.mocked(runPlaybackUiAction);

const makeSong = (id: string, overrides: Partial<Song> = {}): Song => ({
  id,
  title: id,
  artist: 'Artist',
  album: 'Album',
  uri: `file:///${id}.mp3`,
  ...overrides,
});

interface HarnessProps {
  currentSongId?: string | null;
  isPlaying?: boolean;
  filteredSongs: Song[];
  playSong: (song: Song, queue: Song[]) => unknown;
  onOpenTrackInfo?: (song: Song) => void;
  itemsToRender: Song[];
}

const Harness = ({
  currentSongId = null,
  isPlaying = false,
  filteredSongs,
  playSong,
  onOpenTrackInfo = jest.fn(),
  itemsToRender,
}: HarnessProps) => {
  const { renderSongItem, handleSongPress, songKeyExtractor } = useLibrarySongRenderer({
    currentSongId,
    filteredSongs,
    isPlaying,
    onOpenTrackInfo,
    playSong,
  });
  return mockReact.createElement(
    mockReact.Fragment,
    null,
    itemsToRender.map(item => (
      mockReact.createElement(mockReact.Fragment, { key: songKeyExtractor(item) }, renderSongItem({ item }))
    )),
    // Expose handleSongPress via a Text testID so tests can invoke it via a ref.
    mockReact.createElement(Text, {
      testID: 'expose-handler',
      _handler: handleSongPress,
    } as never),
  );
};

beforeEach(() => {
  capturedProps.length = 0;
  jest.clearAllMocks();
});

describe('useLibrarySongRenderer performance guarantees', () => {
  test('keeps onPressSong reference stable when filteredSongs changes', () => {
    const playSong = jest.fn();
    const initialFiltered = [makeSong('a'), makeSong('b')];
    const items = [makeSong('a')];
    const { rerender } = render(
      <Harness filteredSongs={initialFiltered} playSong={playSong} itemsToRender={items} />,
    );
    const firstPress = capturedProps[0].onPressSong;

    // Simulate a search filter narrowing filteredSongs; the row's onPressSong
    // reference must stay stable so React.memo can skip the child render.
    rerender(
      <Harness filteredSongs={[makeSong('a')]} playSong={playSong} itemsToRender={items} />,
    );
    const secondPress = capturedProps[capturedProps.length - 1].onPressSong;

    expect(secondPress).toBe(firstPress);
  });

  test('keeps onPressSong reference stable when playback state changes', () => {
    const playSong = jest.fn();
    const filtered = [makeSong('a'), makeSong('b')];
    const items = [makeSong('a')];
    const { rerender } = render(
      <Harness filteredSongs={filtered} playSong={playSong} itemsToRender={items} isPlaying={false} />,
    );
    const firstPress = capturedProps[0].onPressSong;

    rerender(
      <Harness filteredSongs={filtered} playSong={playSong} itemsToRender={items} isPlaying currentSongId="a" />,
    );

    const secondPress = capturedProps[capturedProps.length - 1].onPressSong;
    expect(secondPress).toBe(firstPress);
  });

  test('uses the latest filteredSongs at press time even when the press handler was captured earlier', () => {
    const playSong = jest.fn();
    const initialFiltered = [makeSong('a'), makeSong('b'), makeSong('c')];
    const items = [makeSong('a')];
    const { rerender } = render(
      <Harness filteredSongs={initialFiltered} playSong={playSong} itemsToRender={items} />,
    );
    const capturedHandler = capturedProps[0].onPressSong;

    // Filter narrows in the meantime (e.g. user typed in the search bar).
    const nextFiltered = [makeSong('a')];
    rerender(<Harness filteredSongs={nextFiltered} playSong={playSong} itemsToRender={items} />);

    capturedHandler(makeSong('a'));

    expect(playSong).toHaveBeenCalledWith(makeSong('a'), nextFiltered);
  });

  test('renderSongItem only rebuilds when currentSongId, isPlaying, variant or onOpenTrackInfo change', () => {
    const playSong = jest.fn();
    const onOpenTrackInfo = jest.fn();
    const filtered = [makeSong('a'), makeSong('b')];
    const items = [makeSong('a')];

    const { rerender } = render(
      <Harness
        filteredSongs={filtered}
        playSong={playSong}
        onOpenTrackInfo={onOpenTrackInfo}
        itemsToRender={items}
        currentSongId="a"
        isPlaying
      />,
    );
    const firstOnInfo = capturedProps[0].onInfoSong;

    // filteredSongs changes but currentSongId/isPlaying/onOpenTrackInfo stay identical.
    rerender(
      <Harness
        filteredSongs={[makeSong('a')]}
        playSong={playSong}
        onOpenTrackInfo={onOpenTrackInfo}
        itemsToRender={items}
        currentSongId="a"
        isPlaying
      />,
    );
    const secondOnInfo = capturedProps[capturedProps.length - 1].onInfoSong;

    expect(secondOnInfo).toBe(firstOnInfo);
  });

  test('propagates isCurrent/isPlaying only for the matching row', () => {
    const playSong = jest.fn();
    const filtered = [makeSong('a'), makeSong('b')];

    render(
      <Harness
        filteredSongs={filtered}
        playSong={playSong}
        itemsToRender={filtered}
        currentSongId="b"
        isPlaying
      />,
    );

    const rowA = capturedProps.find(props => props.song.id === 'a');
    const rowB = capturedProps.find(props => props.song.id === 'b');
    expect(rowA?.isCurrent).toBe(false);
    expect(rowA?.isPlaying).toBe(false);
    expect(rowB?.isCurrent).toBe(true);
    expect(rowB?.isPlaying).toBe(true);
  });

  test('direct handleSongPress call still uses the current filtered queue', () => {
    const playSong = jest.fn();
    const filtered = [makeSong('a'), makeSong('b')];
    const items = [makeSong('a')];

    const screen = render(
      <Harness filteredSongs={filtered} playSong={playSong} itemsToRender={items} />,
    );

    const handler = screen.getByTestId('expose-handler').props._handler as (song: Song, queue?: Song[]) => void;
    handler(makeSong('a'));

    expect(playSong).toHaveBeenCalledWith(makeSong('a'), filtered);
    expect(mockedRunPlaybackUiAction).toHaveBeenCalledWith(
      'library-play-song-a',
      expect.any(Function),
      { dropIfPending: true },
    );
  });
});
