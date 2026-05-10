import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MiniPlayer from '../MiniPlayer';

type MiniCtx = {
  currentSong: { id: string; title: string; artist: string; cover?: string } | null;
  isPlaying: boolean;
  togglePlayPause: jest.Mock<Promise<void>, []>;
  next: jest.Mock<Promise<void>, []>;
  canSkipNext: boolean;
};

const mockUseMiniPlayerMusicContext = jest.fn<MiniCtx, []>();

jest.mock('../../contexts/MusicContext', () => ({
  useMiniPlayerMusicContext: () => mockUseMiniPlayerMusicContext(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

const makeCtx = (overrides: Partial<MiniCtx> = {}): MiniCtx => ({
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  isPlaying: false,
  togglePlayPause: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  canSkipNext: true,
  ...overrides,
});

describe('MiniPlayer', () => {
  beforeEach(() => {
    mockUseMiniPlayerMusicContext.mockReset();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx());
  });

  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<MiniPlayer onOpen={jest.fn()} />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('disabled next tap does not open mini player and does not skip', () => {
    const next = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipNext: false, next }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent.press(getByTestId('mini-player-next'));

    expect(next).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('enabled next tap skips and does not open mini player', () => {
    const next = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipNext: true, next }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent.press(getByTestId('mini-player-next'));

    expect(next).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('tapping parent opens mini player', () => {
    const onOpen = jest.fn();
    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);

    fireEvent.press(getByTestId('mini-player-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('play/pause tap does not open parent', () => {
    const togglePlayPause = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ togglePlayPause }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent.press(getByTestId('mini-player-play-pause'));

    expect(togglePlayPause).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('exposes disabled accessibility state for next', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipNext: false }));
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(getByTestId('mini-player-next').props.accessibilityState?.disabled).toBe(true);
  });

  test('renders null without current song', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ currentSong: null }));
    const { queryByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(queryByTestId('mini-player-open')).toBeNull();
  });
});
