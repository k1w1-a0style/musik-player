import React, { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { mergeUniqueSongs, patchSongById, useLibraryActions } from '../useLibraryActions';
import type { Playlist, Song } from '../../types/Song';
import { StorageKeys, storage } from '../../utils/storage';
import {
  resetNativeQueueMutationLockForTests,
  runExclusiveNativeQueueReplacement,
} from '../../utils/nativeQueueMutationLock';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Three', artist: 'C', uri: 'file:///s3.mp3' },
];

interface ProbeProps {
  initialSongs: Song[];
  initialCurrentSong: Song | null;
  initialPlaybackQueue: Song[];
  initialQueueRef: Song[];
  initialBaseQueueRef: Song[];
  initialNativeQueueRef: Song[];
  nextSongs: Song[];
}

const LibraryProbe = ({
  initialSongs,
  initialCurrentSong,
  initialPlaybackQueue,
  initialQueueRef,
  initialBaseQueueRef,
  initialNativeQueueRef,
  nextSongs,
}: ProbeProps) => {
  const [currentSongs, setSongsState] = useState<Song[]>(initialSongs);
  const [currentSong, setCurrentSong] = useState<Song | null>(initialCurrentSong);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>(initialPlaybackQueue);
  const [, setRenderTick] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[]>([
    { id: 'pl-1', name: 'List', songIds: ['s1', 's3', 'missing'], createdAt: 1, updatedAt: 1 },
  ]);
  const queueContextRef = useRef<Song[]>(initialQueueRef);
  const baseQueueContextRef = useRef<Song[]>(initialBaseQueueRef);
  const nativeQueueRef = useRef<Song[]>(initialNativeQueueRef);
  const playbackQueueCommitsRef = useRef(0);
  const commitPlaybackQueue: Dispatch<SetStateAction<Song[]>> = action => {
    playbackQueueCommitsRef.current += 1;
    setPlaybackQueue(action);
  };

  const { setSongs, addSongs, updateSongMetadata } = useLibraryActions({
    queueContextRef,
    baseQueueContextRef,
    nativeQueueRef,
    setSongsState,
    setCurrentSong,
    setPlaybackQueue: commitPlaybackQueue,
    setPlaylists,
  });

  return (
    <>
      <Text testID="songs">{currentSongs.map(song => song.id).join(',')}</Text>
      <Text testID="current-title">{currentSong?.title ?? ''}</Text>
      <Text testID="playback-queue">{playbackQueue.map(song => song.id).join(',')}</Text>
      <Text testID="playback-queue-titles">{playbackQueue.map(song => song.title).join(',')}</Text>
      <Text testID="queue-ref">{queueContextRef.current.map(song => song.id).join(',')}</Text>
      <Text testID="queue-ref-titles">{queueContextRef.current.map(song => song.title).join(',')}</Text>
      <Text testID="base-queue-ref">{baseQueueContextRef.current.map(song => song.id).join(',')}</Text>
      <Text testID="base-queue-ref-titles">{baseQueueContextRef.current.map(song => song.title).join(',')}</Text>
      <Text testID="native-ref">{nativeQueueRef.current.map(song => song.id).join(',')}</Text>
      <Text testID="playback-queue-commits">{playbackQueueCommitsRef.current}</Text>
      <Text testID="playlist-songs">{playlists[0]?.songIds.join(',') ?? ''}</Text>
      <Button testID="set-songs" title="set" onPress={() => setSongs(nextSongs)} />
      <Button testID="add-songs" title="add" onPress={() => addSongs([songs[0], songs[1]])} />
      <Button testID="patch-song" title="patch" onPress={() => updateSongMetadata('s1', { title: 'Updated' })} />
      <Button testID="patch-song-s2" title="patch s2" onPress={() => updateSongMetadata('s2', { title: 'Updated Two' })} />
      <Button testID="rerender" title="rerender" onPress={() => setRenderTick(prev => prev + 1)} />
    </>
  );
};

describe('useLibraryActions', () => {
  beforeEach(async () => {
    resetNativeQueueMutationLockForTests();
    jest.clearAllMocks();
    await storage.remove(StorageKeys.CURRENT_SONG_ID);
  });

  test('merges unique songs', () => {
    expect(mergeUniqueSongs([songs[0]], [songs[0], songs[1]])).toEqual([songs[0], songs[1]]);
  });

  test('patches song by id', () => {
    expect(patchSongById('s1', { title: 'Updated' })(songs[0]).title).toBe('Updated');
    expect(patchSongById('missing', { title: 'Updated' })(songs[0])).toBe(songs[0]);
  });

  test('removing a non-queued song keeps native queue stable and does not reset player', async () => {
    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0]]}
        initialQueueRef={[songs[0]]}
        initialBaseQueueRef={[songs[0]]}
        initialNativeQueueRef={[songs[0]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(getByTestId('songs').props.children).toBe('s1,s2'));
    expect(getByTestId('playback-queue').props.children).toBe('s1');
    expect(getByTestId('queue-ref').props.children).toBe('s1');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1');
    expect(getByTestId('native-ref').props.children).toBe('s1');
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('removing queued/current song clears current id and rebuilds native queue', async () => {
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
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

    await waitFor(() => {
      expect(getByTestId('current-title').props.children).toBe('');
      expect(getByTestId('playback-queue').props.children).toBe('s2');
      expect(getByTestId('queue-ref').props.children).toBe('s2');
      expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    });
    await waitFor(() => expect(TrackPlayer.reset).toHaveBeenCalledTimes(1));
    expect(TrackPlayer.add).toHaveBeenCalledWith([expect.objectContaining({ id: 's2' })]);
    expect(TrackPlayer.add).not.toHaveBeenCalledWith([expect.objectContaining({ id: 's1' })]);
    expect(getByTestId('playback-queue-commits').props.children).toBe(1);
    await waitFor(async () => expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull());
  });

  test('native sync does not set ref when add is superseded by a newer replacement intent', async () => {
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
  });

  test('metadata updates during pending native sync are preserved', async () => {
    const deferredAdd: { resolve: () => void }[] = [];
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          deferredAdd.push({ resolve });
        }),
    );

    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[1]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1], songs[2]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));
    await waitFor(() => expect(deferredAdd.length).toBe(1));

    act(() => fireEvent.press(getByTestId('patch-song-s2')));

    await act(async () => {
      deferredAdd[0].resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(getByTestId('queue-ref').props.children).toBe('s2'));
    expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    expect(getByTestId('playback-queue').props.children).toBe('s2');
    expect(getByTestId('queue-ref-titles').props.children).toBe('Updated Two');
    expect(getByTestId('base-queue-ref-titles').props.children).toBe('Updated Two');
    expect(getByTestId('playback-queue-titles').props.children).toBe('Updated Two');
  });

  test('prunes stale playback state with one queue state commit when queue refs are already clean', async () => {
    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[1]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[1]]}
        initialBaseQueueRef={[songs[1]]}
        initialNativeQueueRef={[songs[1]]}
        nextSongs={[songs[1], songs[2]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(getByTestId('playback-queue').props.children).toBe('s2'));
    expect(getByTestId('queue-ref').props.children).toBe('s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    expect(getByTestId('native-ref').props.children).toBe('s2');
    expect(getByTestId('playback-queue-commits').props.children).toBe(1);
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('removing all queued songs resets player and clears native ref without add', async () => {
    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0]]}
        initialQueueRef={[songs[0]]}
        initialBaseQueueRef={[songs[0]]}
        initialNativeQueueRef={[songs[0]]}
        nextSongs={[songs[1], songs[2]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => {
      expect(getByTestId('playback-queue').props.children).toBe('');
      expect(getByTestId('queue-ref').props.children).toBe('');
    });
    await waitFor(() => expect(TrackPlayer.reset).toHaveBeenCalled());
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('native reset failure prunes JS queue refs without marking native queue synced', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.reset as jest.Mock).mockRejectedValueOnce(new Error('reset failed'));

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

    await waitFor(() => expect(TrackPlayer.reset).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId('playback-queue').props.children).toBe('s2'));
    expect(getByTestId('songs').props.children).toBe('s2,s3');
    expect(getByTestId('queue-ref').props.children).toBe('s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s2');
    expect(getByTestId('native-ref').props.children).toBe('s1,s2');
    expect(getByTestId('queue-ref').props.children).not.toContain('s1');
    expect(getByTestId('base-queue-ref').props.children).not.toContain('s1');
    expect(getByTestId('playback-queue').props.children).not.toContain('s1');
    expect(warn).toHaveBeenCalledWith('[LibraryRemove] Failed to sync native queue after library update.', expect.any(Error));
  });

  test('add failure after successful reset reconciles queue refs without removed songs', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.add as jest.Mock).mockRejectedValueOnce(new Error('add failed'));

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

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenCalled());
    await waitFor(() => expect(getByTestId('native-ref').props.children).toBe(''));
    expect(getByTestId('queue-ref').props.children).toBe('');
    expect(getByTestId('base-queue-ref').props.children).toBe('');
    expect(getByTestId('playback-queue').props.children).toBe('');
    expect(getByTestId('queue-ref').props.children).not.toContain('s1');
    expect(getByTestId('base-queue-ref').props.children).not.toContain('s1');
    expect(getByTestId('playback-queue').props.children).not.toContain('s1');
    expect(warn).toHaveBeenCalledWith('[LibraryRemove] Failed to sync native queue after library update.', expect.any(Error));
  });

  test('baseQueue-only change does not trigger native rebuild', async () => {
    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0]]}
        initialQueueRef={[songs[0]]}
        initialBaseQueueRef={[songs[0], songs[2]]}
        initialNativeQueueRef={[songs[0]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(getByTestId('songs').props.children).toBe('s1,s2'));
    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
  });

  test('new setSongs call invalidates older pending native sync even when second call does not start a new native sync', async () => {
    const deferredReset: { resolve: () => void }[] = [];
    (TrackPlayer.reset as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          deferredReset.push({ resolve });
        }),
    );

    const { getByTestId, rerender } = render(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));
    await waitFor(() => expect(deferredReset.length).toBe(1));

    rerender(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(1);
    expect(getByTestId('queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue').props.children).toBe('s1,s2');

    await act(async () => {
      deferredReset[0].resolve();
      await Promise.resolve();
    });

    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(getByTestId('queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue-commits').props.children).toBe(1);
  });

  test('stale sync after successful reset clears or invalidates nativeQueueRef', async () => {
    const deferredReset: { resolve: () => void }[] = [];
    (TrackPlayer.reset as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          deferredReset.push({ resolve });
        }),
    );

    const { getByTestId, rerender } = render(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));
    await waitFor(() => expect(deferredReset.length).toBe(1));

    rerender(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await act(async () => {
      deferredReset[0].resolve();
      await Promise.resolve();
    });
    act(() => fireEvent.press(getByTestId('rerender')));

    expect(getByTestId('native-ref').props.children).toBe('');
    expect(getByTestId('queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue-commits').props.children).toBe(1);
    expect(TrackPlayer.add).not.toHaveBeenCalled();

    rerender(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 's1' }),
      expect.objectContaining({ id: 's2' }),
    ]));
    act(() => fireEvent.press(getByTestId('rerender')));

    expect(getByTestId('native-ref').props.children).toBe('s1,s2');
    expect(getByTestId('queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1,s2');
  });

  test('stale native sync does not update nativeQueueRef after native add resolves', async () => {
    const deferredAdd: { resolve: () => void }[] = [];
    (TrackPlayer.add as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          deferredAdd.push({ resolve });
        }),
    );

    const { getByTestId, rerender } = render(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));
    await waitFor(() => expect(deferredAdd.length).toBe(1));

    rerender(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await act(async () => {
      deferredAdd[0].resolve();
      await Promise.resolve();
    });
    act(() => fireEvent.press(getByTestId('rerender')));

    expect(getByTestId('native-ref').props.children).toBe('s1,s2');
    expect(getByTestId('queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue').props.children).toBe('s1,s2');
    expect(getByTestId('playback-queue-commits').props.children).toBe(1);

    rerender(
      <LibraryProbe
        initialSongs={[songs[0], songs[1]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={[songs[0]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(getByTestId('native-ref').props.children).toBe('s1'));
    expect(getByTestId('queue-ref').props.children).toBe('s1');
    expect(getByTestId('base-queue-ref').props.children).toBe('s1');
    expect(TrackPlayer.add).toHaveBeenLastCalledWith([expect.objectContaining({ id: 's1' })]);
  });

  test('latest native sync wins across overlapping setSongs calls', async () => {
    const deferred: { resolve: () => void }[] = [];
    (TrackPlayer.reset as jest.Mock).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          deferred.push({ resolve });
        }),
    );

    const { getByTestId, rerender } = render(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1], songs[2]]}
        initialQueueRef={[songs[0], songs[1], songs[2]]}
        initialBaseQueueRef={[songs[0], songs[1], songs[2]]}
        initialNativeQueueRef={[songs[0], songs[1], songs[2]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('set-songs')));

    rerender(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1], songs[2]]}
        initialQueueRef={[songs[0], songs[1], songs[2]]}
        initialBaseQueueRef={[songs[0], songs[1], songs[2]]}
        initialNativeQueueRef={[songs[0], songs[1], songs[2]]}
        nextSongs={[songs[0]]}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(deferred.length).toBe(1));
    deferred[0].resolve();

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenLastCalledWith([expect.objectContaining({ id: 's1' })]));
  });

  test('stale current-song cleanup does not remove restored current song id', async () => {
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's1');
    const removeSpy = jest.spyOn(storage, 'remove');
    const firstGetDeferred: { resolve: (value: string | null) => void } = {
      resolve: () => undefined,
    };
    let firstGetPending = true;
    const originalGet = storage.get.bind(storage);
    const getMock = jest.spyOn(storage, 'get').mockImplementation(async key => {
      if (key !== StorageKeys.CURRENT_SONG_ID) return originalGet(key);
      if (firstGetPending) {
        firstGetPending = false;
        return new Promise(resolve => {
          firstGetDeferred.resolve = resolve;
        });
      }
      return 's1';
    });

    const { getByTestId, rerender } = render(
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

    rerender(
      <LibraryProbe
        initialSongs={songs}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0], songs[1]]}
        initialQueueRef={[songs[0], songs[1]]}
        initialBaseQueueRef={[songs[0], songs[1]]}
        initialNativeQueueRef={[songs[0], songs[1]]}
        nextSongs={songs}
      />,
    );
    act(() => fireEvent.press(getByTestId('set-songs')));

    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
    firstGetDeferred.resolve('s1');
    await Promise.resolve();

    await waitFor(async () => expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBe('s1'));
    expect(removeSpy).not.toHaveBeenCalledWith(StorageKeys.CURRENT_SONG_ID);
  });

  test('logs current cleanup failures for latest cleanup only', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getError = new Error('get failed');
    jest.spyOn(storage, 'get').mockRejectedValueOnce(getError);

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
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('[LibraryRemove] Failed to clear current song id after removal.', getError),
    );
  });

  test('adds only missing songs', () => {
    const { getByTestId } = render(
      <LibraryProbe
        initialSongs={[songs[0]]}
        initialCurrentSong={songs[0]}
        initialPlaybackQueue={[songs[0]]}
        initialQueueRef={[songs[0]]}
        initialBaseQueueRef={[songs[0]]}
        initialNativeQueueRef={[songs[0]]}
        nextSongs={[songs[0], songs[1]]}
      />,
    );

    act(() => fireEvent.press(getByTestId('add-songs')));

    expect(getByTestId('songs').props.children).toBe('s1,s2');
  });
});
