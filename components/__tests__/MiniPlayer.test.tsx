import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MiniPlayer from '../MiniPlayer';

type MiniCtx = {
  currentSong: { id: string; title: string; artist: string; album?: string; cover?: string; uri?: string; fileInfo?: { filename?: string; uri?: string } } | null;
  isPlaying: boolean;
  togglePlayPause: jest.Mock<Promise<void>, []>;
  next: jest.Mock<Promise<void>, []>;
  previous: jest.Mock<Promise<void>, []>;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
};

type PaletteCtx = {
  palette: {
    dominant?: string;
    vibrant?: string;
    lightVibrant?: string;
    darkVibrant?: string;
    muted?: string;
    lightMuted?: string;
    darkMuted?: string;
  } | null;
};

const mockUseMiniPlayerMusicContext = jest.fn<MiniCtx, []>();
const mockUseMusicContext = jest.fn<PaletteCtx, []>();
const mockUseMiniPlayerProgress = jest.fn<number, []>();

jest.mock('../../contexts/MusicContext', () => ({
  useMiniPlayerMusicContext: () => mockUseMiniPlayerMusicContext(),
  useMusicContext: () => mockUseMusicContext(),
}));

jest.mock('../../hooks/useMiniPlayerProgress', () => {
  const actual = jest.requireActual('../../hooks/useMiniPlayerProgress');
  return {
    ...actual,
    useMiniPlayerProgress: () => mockUseMiniPlayerProgress(),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

const mockAppTheme = {
  palette: {
    primary: '#7CFFCB',
    border: 'rgba(210, 218, 230, 0.18)',
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    surfaceElevated: '#191B21',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
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

const makeCtx = (overrides: Partial<MiniCtx> = {}): MiniCtx => ({
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  isPlaying: false,
  togglePlayPause: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  previous: jest.fn(async () => undefined),
  canSkipNext: true,
  canSkipPrevious: true,
  ...overrides,
});

describe('MiniPlayer', () => {
  beforeEach(() => {
    mockUseMiniPlayerMusicContext.mockReset();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx());
    mockUseMusicContext.mockReset();
    mockUseMusicContext.mockReturnValue({ palette: null });
    mockUseMiniPlayerProgress.mockReset();
    mockUseMiniPlayerProgress.mockReturnValue(0.42);
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
    fireEvent(getByTestId('mini-player-next'), 'press', { stopPropagation: jest.fn() });

    expect(next).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('enabled next tap skips and does not open mini player', () => {
    const next = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipNext: true, next }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent(getByTestId('mini-player-next'), 'press', { stopPropagation: jest.fn() });

    expect(next).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('disabled previous tap does not open mini player and does not skip', () => {
    const previous = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipPrevious: false, previous }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent(getByTestId('mini-player-previous'), 'press', { stopPropagation: jest.fn() });

    expect(previous).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('enabled previous tap skips and does not open mini player', () => {
    const previous = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipPrevious: true, previous }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent(getByTestId('mini-player-previous'), 'press', { stopPropagation: jest.fn() });

    expect(previous).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('tapping parent opens mini player', () => {
    const onOpen = jest.fn();
    const { getByTestId, getByLabelText } = render(<MiniPlayer onOpen={onOpen} />);

    expect(getByLabelText('Wiedergabe öffnen')).toBeTruthy();

    fireEvent.press(getByTestId('mini-player-open'));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('play/pause tap does not open parent', () => {
    const togglePlayPause = jest.fn(async () => undefined);
    const onOpen = jest.fn();
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ togglePlayPause }));

    const { getByTestId } = render(<MiniPlayer onOpen={onOpen} />);
    fireEvent(getByTestId('mini-player-play-pause'), 'press', { stopPropagation: jest.fn() });

    expect(togglePlayPause).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test('renders a themed playback progress line', () => {
    mockUseMiniPlayerProgress.mockReturnValue(0.42);

    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);
    const fillStyle = JSON.stringify(getByTestId('mini-player-progress-fill').props.style);

    expect(getByTestId('mini-player-progress')).toBeTruthy();
    expect(fillStyle).toContain('42%');
    expect(fillStyle).not.toContain('undefined');
  });

  test('uses cover palette accent for progress and chrome when available', () => {
    mockUseMusicContext.mockReturnValue({
      palette: { vibrant: '#AA5500', muted: '#553311' },
    });

    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);
    const containerStyle = JSON.stringify(getByTestId('mini-player-open').props.style);
    const fillStyle = JSON.stringify(getByTestId('mini-player-progress-fill').props.style);

    expect(containerStyle).toContain('#553311');
    expect(fillStyle).toContain('#AA5500');
  });

  test('exposes disabled accessibility state for next', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipNext: false }));
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(getByTestId('mini-player-next').props.accessibilityState?.disabled).toBe(true);
  });

  test('exposes disabled accessibility state for previous', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ canSkipPrevious: false }));
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(getByTestId('mini-player-previous').props.accessibilityState?.disabled).toBe(true);
  });

  test('exposes next button accessibility label', () => {
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(getByTestId('mini-player-next').props.accessibilityLabel).toBe('Nächster Titel');
  });

  test('uses display title fallback for placeholder current song title', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({
      currentSong: { id: 's1', title: '<unknown>', artist: 'Artist', fileInfo: { filename: 'My%20Song.m4a' } },
    }));

    const { getByText, queryByText } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(queryByText('<unknown>')).toBeNull();
    expect(getByText('My Song')).toBeTruthy();
  });

  test('uses app theme chrome instead of the old hard-coded turquoise border', () => {
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);
    const styleText = JSON.stringify(getByTestId('mini-player-open').props.style);

    expect(styleText).toContain(mockAppTheme.palette.surfaceGlass);
    expect(styleText).not.toContain('rgba(115, 230, 210, 0.9)');
  });

  test('clips the mini player progress to the rounded container', () => {
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);
    const styleText = JSON.stringify(getByTestId('mini-player-open').props.style);

    expect(styleText).toContain('hidden');
  });

  test('renders null without current song', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue(makeCtx({ currentSong: null }));
    const { queryByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);

    expect(queryByTestId('mini-player-open')).toBeNull();
  });
});
