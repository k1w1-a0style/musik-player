import React from 'react';
import { Text, Pressable } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { MusicProvider, useMusicContext } from '../MusicContext';
import { storage, StorageKeys } from '../../utils/storage';
import type { Song } from '../../types/Song';
import AsyncStorage from '@react-native-async-storage/async-storage';


jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => undefined),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

type RNTPMock = typeof TrackPlayer & {
  __reset: () => void;
  __getQueue: () => unknown[];
};

const SONGS: Song[] = [
  { id: 's1', title: 'Song 1', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Song 2', artist: 'A', uri: 'file:///s2.mp3', cover: 'file:///cover-s2.jpg', coverInfo: { status: 'cached', uri: 'file:///cover-s2.jpg' } },
  { id: 's3', title: 'Song 3', artist: 'B', uri: 'file:///s3.mp3' },
  { id: 's4', title: 'Song 4', artist: 'B', uri: 'file:///s4.mp3' },
];

const Probe: React.FC = () => {
  const ctx = useMusicContext();
  return (
    <>
      <Text testID="probe-current">{ctx.currentSong?.id ?? '-'}</Text>
      <Text testID="probe-playback-queue">{ctx.playbackQueue.map(song => song.id).join(',')}</Text>
      <Text testID="probe-playback-queue-titles">{ctx.playbackQueue.map(song => song.title).join(',')}</Text>
      <Text testID="probe-song-s2-title">{ctx.songs.find(song => song.id === 's2')?.title ?? '-'}</Text>
      <Text testID="probe-song-s2-cover">{ctx.songs.find(song => song.id === 's2')?.cover ?? '-'}</Text>
      <Text testID="probe-songs-count">{String(ctx.songs.length)}</Text>
      <Text testID="probe-shuffle">{String(ctx.shuffle)}</Text>
      <Text testID="probe-repeat">{ctx.repeatMode}</Text>
      <Text testID="probe-volume">{String(ctx.volume)}</Text>
      <Text testID="probe-eq">{ctx.eqPreset}</Text>
      <Text testID="probe-eq-band-0">{String(ctx.eqBands[0])}</Text>
      <Text testID="probe-playlists-count">{String(ctx.playlists.length)}</Text>
      <Text testID="probe-ready">{String(ctx.isReady)}</Text>
      <Pressable testID="set-songs" onPress={() => ctx.setSongs(SONGS)}>
        <Text>set</Text>
      </Pressable>
      <Pressable testID="play-s2" onPress={() => ctx.playSong(SONGS[1], SONGS)}>
        <Text>play s2</Text>
      </Pressable>
      <Pressable testID="play-s3-subset" onPress={() => ctx.playSong(SONGS[2], [SONGS[2], SONGS[3]])}>
        <Text>play s3 subset</Text>
      </Pressable>
      <Pressable testID="play-demo" onPress={() => ctx.playSong({ id: 'demo-1', title: 'Demo 1', artist: 'Demo', uri: 'file:///demo1.mp3' })}>
        <Text>play demo</Text>
      </Pressable>
      <Pressable testID="toggle-shuffle" onPress={() => ctx.toggleShuffle()}>
        <Text>shuffle</Text>
      </Pressable>
      <Pressable testID="apply-rock" onPress={() => ctx.applyEqPreset('rock')}>
        <Text>rock</Text>
      </Pressable>
      <Pressable testID="set-band-0" onPress={() => ctx.setEqBand(0, 7)}>
        <Text>band</Text>
      </Pressable>
      <Pressable testID="set-volume" onPress={() => ctx.setVolume(0.5)}>
        <Text>vol</Text>
      </Pressable>
      <Pressable testID="cycle-repeat" onPress={() => ctx.cycleRepeatMode()}>
        <Text>repeat</Text>
      </Pressable>
      <Pressable testID="patch-s2-title" onPress={() => ctx.updateSongMetadata('s2', { title: 'Song 2 Edited', album: 'Edited Album' })}>
        <Text>patch s2</Text>
      </Pressable>
      <Pressable testID="patch-s2-cover-clear" onPress={() => ctx.updateSongMetadata('s2', { cover: undefined, coverInfo: undefined })}>
        <Text>patch s2 cover clear</Text>
      </Pressable>
      <Pressable testID="patch-s1-title" onPress={() => ctx.updateSongMetadata('s1', { title: 'Song 1 Edited' })}>
        <Text>patch s1</Text>
      </Pressable>
      <Pressable testID="patch-s3-title" onPress={() => ctx.updateSongMetadata('s3', { title: 'Song 3 Edited' })}>
        <Text>patch s3</Text>
      </Pressable>
      <Pressable testID="add-pl" onPress={() => ctx.createPlaylist('Drive')}>
        <Text>pl</Text>
      </Pressable>
    </>
  );
};

const renderProvider = (): ReturnType<typeof render> =>
  render(
    <MusicProvider>
      <Probe />
    </MusicProvider>,
  );

const waitReady = async (getByTestId: (s: string) => { props: { children: unknown } }) => {
  await waitFor(() => expect(getByTestId('probe-ready').props.children).toBe('true'));
};

beforeEach(() => {
  (TrackPlayer as RNTPMock).__reset();
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();


});

describe('MusicContext', () => {
  test('hydrates ready=true and applies persisted defaults', async () => {
    await storage.set(StorageKeys.VOLUME, 0.42);
    await storage.set(StorageKeys.EQ_PRESET, 'jazz');
    await storage.set(StorageKeys.SHUFFLE, true);
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    expect(getByTestId('probe-volume').props.children).toBe('0.42');
    expect(getByTestId('probe-eq').props.children).toBe('jazz');
    expect(getByTestId('probe-shuffle').props.children).toBe('true');
    expect(TrackPlayer.setupPlayer).toHaveBeenCalled();
  });

  test('playSong adds tracks to queue and updates current song', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => {
      fireEvent.press(getByTestId('set-songs'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('play-s2'));
    });
    await waitFor(() => {
      expect(TrackPlayer.add).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();
    });
    expect((TrackPlayer as RNTPMock).__getQueue().length).toBeGreaterThan(0);
    expect(getByTestId('probe-current').props.children).toBe('s2');
  });

  test('playSong(song) still plays a playable song outside library context', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);

    await act(async () => fireEvent.press(getByTestId('play-demo')));

    await waitFor(() => {
      expect(TrackPlayer.add).toHaveBeenCalled();
      expect(TrackPlayer.play).toHaveBeenCalled();
    });
    const queue = (TrackPlayer as RNTPMock).__getQueue() as Array<{ id: string }>;
    expect(queue).toHaveLength(1);
    expect(queue[0]?.id).toBe('demo-1');
    expect(getByTestId('probe-current').props.children).toBe('demo-1');
    expect(getByTestId('probe-playback-queue').props.children).toBe('demo-1');
  });

  test('playSong(song, queue) keeps provided queue context for shuffle', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-songs')));
    await act(async () => fireEvent.press(getByTestId('play-s3-subset')));
    await act(async () => fireEvent.press(getByTestId('toggle-shuffle')));

    await waitFor(() => expect(TrackPlayer.add).toHaveBeenCalledTimes(2));
    const shuffledQueue = (TrackPlayer as RNTPMock).__getQueue() as Array<{ id: string }>;
    expect(shuffledQueue).toHaveLength(2);
    expect(shuffledQueue[0]?.id).toBe('s3');
    expect(shuffledQueue.map(track => track.id).sort()).toEqual(['s3', 's4']);
    const playbackQueueIds = String(getByTestId('probe-playback-queue').props.children).split(',').sort();
    expect(playbackQueueIds).toEqual(['s3', 's4']);
  });

  test('applyEqPreset sets bands + persists; setEqBand switches to custom', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('apply-rock')));
    await waitFor(() => expect(getByTestId('probe-eq').props.children).toBe('rock'));
    await act(async () => fireEvent.press(getByTestId('set-band-0')));
    await waitFor(() => expect(getByTestId('probe-eq').props.children).toBe('custom'));
    expect(getByTestId('probe-eq-band-0').props.children).toBe('7');
  });

  test('cycleRepeatMode goes off → all → one → off', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    expect(getByTestId('probe-repeat').props.children).toBe('off');
    await act(async () => fireEvent.press(getByTestId('cycle-repeat')));
    await waitFor(() => expect(getByTestId('probe-repeat').props.children).toBe('all'));
    await act(async () => fireEvent.press(getByTestId('cycle-repeat')));
    await waitFor(() => expect(getByTestId('probe-repeat').props.children).toBe('one'));
    await act(async () => fireEvent.press(getByTestId('cycle-repeat')));
    await waitFor(() => expect(getByTestId('probe-repeat').props.children).toBe('off'));
    expect(TrackPlayer.setRepeatMode).toHaveBeenCalledTimes(3);
  });

  test('setVolume updates state and TrackPlayer.setVolume', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-volume')));
    await waitFor(() => expect(getByTestId('probe-volume').props.children).toBe('0.5'));
    expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.5);
  });

  test('createPlaylist adds entry and persists to storage', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('add-pl')));
    await waitFor(() => expect(getByTestId('probe-playlists-count').props.children).toBe('1'));
    // Persisted via the effect — give the microtask queue a chance
    await waitFor(async () => {
      const stored = await storage.get<{ name: string }[]>(StorageKeys.PLAYLISTS);
      expect(stored?.[0]?.name).toBe('Drive');
    });
  });



  test('updateSongMetadata updates songs/currentSong/playbackQueue and keeps queue order', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-songs')));
    await act(async () => fireEvent.press(getByTestId('play-s2')));
    expect(getByTestId('probe-playback-queue').props.children).toBe('s2,s3,s4,s1');

    await act(async () => fireEvent.press(getByTestId('patch-s2-title')));

    expect(getByTestId('probe-song-s2-title').props.children).toBe('Song 2 Edited');
    expect(getByTestId('probe-current').props.children).toBe('s2');
    expect(getByTestId('probe-playback-queue').props.children).toBe('s2,s3,s4,s1');
    expect(String(getByTestId('probe-playback-queue-titles').props.children)).toMatch(/^Song 2 Edited,/);
  });

  test('updateSongMetadata clears cover and coverInfo when patch values are undefined', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-songs')));
    await act(async () => fireEvent.press(getByTestId('patch-s2-cover-clear')));
    expect(getByTestId('probe-song-s2-cover').props.children).toBe('-');
  });


  test('updateSongMetadata syncs native metadata using queue indexes for queued songs and not for non-queued songs', async () => {
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-songs')));
    await act(async () => fireEvent.press(getByTestId('play-s2')));

    const resetCallsBeforeMetadataPatch = (TrackPlayer.reset as jest.Mock).mock.calls.length;
    const addCallsBeforeMetadataPatch = (TrackPlayer.add as jest.Mock).mock.calls.length;

    await act(async () => fireEvent.press(getByTestId('patch-s2-title')));

    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({
        id: 's2',
        title: 'Song 2 Edited',
        artist: 'A',
        album: 'Edited Album',
        artwork: 'file:///cover-s2.jpg',
      }),
    );
    expect((TrackPlayer.updateMetadataForTrack as jest.Mock).mock.calls[0]?.[0]).toBe(0);
    expect((TrackPlayer.updateMetadataForTrack as jest.Mock).mock.calls[0]?.[0]).not.toBe('s2');

    await act(async () => fireEvent.press(getByTestId('patch-s3-title')));
    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ id: 's3', title: 'Song 3 Edited' }),
    );

    expect(TrackPlayer.reset).toHaveBeenCalledTimes(resetCallsBeforeMetadataPatch);
    expect(TrackPlayer.add).toHaveBeenCalledTimes(addCallsBeforeMetadataPatch);

    (TrackPlayer.updateMetadataForTrack as jest.Mock).mockClear();
    await act(async () => fireEvent.press(getByTestId('play-s3-subset')));
    await act(async () => fireEvent.press(getByTestId('patch-s1-title')));
    expect(TrackPlayer.updateMetadataForTrack).not.toHaveBeenCalled();
  });


  test('mock queue updateMetadataForTrack treats first argument as queue index and ignores out-of-range', async () => {
    await (TrackPlayer.add as jest.Mock)([
      { id: 'q1', title: 'Queue 1' },
      { id: 'q2', title: 'Queue 2' },
    ]);

    await TrackPlayer.updateMetadataForTrack(1, { title: 'Queue 2 Updated', artist: 'Artist 2' });
    let queue = (TrackPlayer as RNTPMock).__getQueue() as Array<{ id: string; title: string; artist?: string }>;
    expect(queue[0]).toMatchObject({ id: 'q1', title: 'Queue 1' });
    expect(queue[1]).toMatchObject({ id: 'q2', title: 'Queue 2 Updated', artist: 'Artist 2' });

    await TrackPlayer.updateMetadataForTrack(99, { title: 'Out of Range' });
    queue = (TrackPlayer as RNTPMock).__getQueue() as Array<{ id: string; title: string }>;
    expect(queue[1]).toMatchObject({ id: 'q2', title: 'Queue 2 Updated' });
  });

  test('updateSongMetadata cover removal syncs native artwork undefined and handles native failure as non-fatal', async () => {
    (TrackPlayer.updateMetadataForTrack as jest.Mock).mockRejectedValueOnce(new Error('native fail'));
    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);
    await act(async () => fireEvent.press(getByTestId('set-songs')));
    await act(async () => fireEvent.press(getByTestId('play-s2')));

    await act(async () => fireEvent.press(getByTestId('patch-s2-cover-clear')));

    expect(getByTestId('probe-song-s2-cover').props.children).toBe('-');
    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ id: 's2', artwork: undefined }),
    );
    expect(getByTestId('probe-playback-queue').props.children).toBe('s2,s3,s4,s1');
  });

  test('hydrates songs by migrating base64 covers before persisting', async () => {
    await storage.set(StorageKeys.SONGS, [
      { id: 's1', title: 'Song 1', artist: 'A', uri: 'file:///s1.mp3', cover: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' },
    ]);

    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);

    await waitFor(async () => {
      const stored = await storage.get<Song[]>(StorageKeys.SONGS);
      expect(stored?.[0]?.cover).toMatch(/^file:\/\/\/docs\/covers\/.+\.png$/);
      expect(stored?.[0]?.cover?.startsWith('data:image/')).toBe(false);
    });
  });

  test('hydrates CURRENT_SONG_ID without autoplay', async () => {
    await storage.set(StorageKeys.SONGS, SONGS);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's2');

    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);

    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));
    expect(TrackPlayer.play).not.toHaveBeenCalled();
    const queue = (TrackPlayer as RNTPMock).__getQueue() as Array<{ id: string }>;
    expect(queue[0]?.id).toBe('s2');
    expect(getByTestId('probe-playback-queue').props.children).toBe('s2,s3,s4,s1');
  });

});
