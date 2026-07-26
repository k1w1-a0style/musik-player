'use strict';

const fs = require('fs');

const replaceExactlyOnce = (source, oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  return source.replace(oldText, newText);
};

const libraryPath = 'contexts/__tests__/useLibraryActions.test.tsx';
let library = fs.readFileSync(libraryPath, 'utf8');
library = replaceExactlyOnce(
  library,
`  test('native sync does not set ref when add is superseded by a newer replacement intent', async () => {
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      void runExclusiveNativeQueueReplacement(async () => undefined);
    });

    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1], songs[2]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's2' })]));
    await waitFor(() => expect(getByTestId('queue-ref').props.children).toBe('s2'));
    expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    expect(getByTestId('playback-queue').props.children).toBe('s2');
    expect(getByTestId('native-ref').props.children).toBe('');
  });`,
`  test('native sync keeps ref truthful when a newer replacement is queued during add', async () => {
    let newerReplacement: Promise<void> | undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
        expect(isCurrent()).toBe(true);
      });
    });

    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1], songs[2]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's2' })]));
    await newerReplacement;
    await waitFor(() => expect(getByTestId('queue-ref').props.children).toBe('s2'));
    expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    expect(getByTestId('playback-queue').props.children).toBe('s2');
    expect(getByTestId('native-ref').props.children).toBe('s2');
  });`,
  'library native-ref truth test',
);
fs.writeFileSync(libraryPath, library);

const hydrationPath = 'contexts/__tests__/musicHydrationHelpers.test.ts';
let hydration = fs.readFileSync(hydrationPath, 'utf8');
hydration = replaceExactlyOnce(
  hydration,
`  test('does not set hydrated native queue ref when add is superseded before commit', async () => {
    const nativeQueueRef = createSongRef();
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      void runExclusiveNativeQueueReplacement(async () => undefined);
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });

    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(nativeQueueRef.current).toEqual([]);
  });`,
`  test('keeps hydrated native queue ref truthful when a newer replacement is queued during add', async () => {
    const nativeQueueRef = createSongRef();
    let newerReplacement: Promise<void> | undefined;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      newerReplacement = runExclusiveNativeQueueReplacement(async ({ isCurrent }) => {
        expect(isCurrent()).toBe(true);
        expect(nativeQueueRef.current).toEqual(songs);
      });
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => false,
    });
    await newerReplacement;

    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(nativeQueueRef.current).toEqual(songs);
  });`,
  'hydration queued replacement truth test',
);
hydration = replaceExactlyOnce(
  hydration,
`  test('does not set hydrated native queue ref when cancelled after add', async () => {
    const nativeQueueRef = createSongRef();
    let cancelled = false;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      cancelled = true;
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => cancelled,
    });

    expect(TrackPlayer.add).toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual([]);
  });`,
`  test('keeps hydrated native queue ref truthful when cancelled after add', async () => {
    const nativeQueueRef = createSongRef();
    let cancelled = false;
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(async () => {
      cancelled = true;
    });

    await hydrateStoredSongs({
      stored: {
        songs,
        playlists: null,
        eqEnabled: null,
        eqBands: null,
        eqPreset: null,
        volume: null,
        repeatMode: null,
        shuffle: false,
        currentSongId: 's1',
      },
      songsRef: createSongRef(),
      queueContextRef: createSongRef(),
      baseQueueContextRef: createSongRef(),
      nativeQueueRef,
      setSongsState: jest.fn(),
      setCurrentSong: jest.fn(),
      setPlaybackQueue: jest.fn(),
      isCancelled: () => cancelled,
    });

    expect(TrackPlayer.add).toHaveBeenCalled();
    expect(nativeQueueRef.current).toEqual(songs);
  });`,
  'hydration cancellation truth test',
);
fs.writeFileSync(hydrationPath, hydration);
