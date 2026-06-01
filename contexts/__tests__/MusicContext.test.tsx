import React from 'react';
import { Text, Pressable } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import TrackPlayer from 'react-native-track-player';
import { MusicProvider, useMusicContext } from '../MusicContext';
import { storage, StorageKeys } from '../../utils/storage';
import type { Song } from '../../types/Song';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SystemAudio from 'expo-system-audio';

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
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

type RNTPMock = typeof TrackPlayer & {
  __reset: () => void;
  __getQueue: () => unknown[];
  __getRepeatMode: () => number;
  __trigger: (event: string, payload: unknown) => void;
};

const SONGS: Song[] = [
  { id: 's1', title: 'Song 1', artist: 'A', uri: 'file:///s1.mp3' },
  {
    id: 's2',
    title: 'Song 2',
    artist: 'A',
    uri: 'file:///s2.mp3',
    cover: 'file:///cover-s2.jpg',
    coverInfo: { status: 'cached', uri: 'file:///cover-s2.jpg' },
  },
  { id: 's3', title: 'Song 3', artist: 'B', uri: 'file:///s3.mp3' },
  { id: 's4', title: 'Song 4', artist: 'B', uri: 'file:///s4.mp3' },
];

const Probe: React.FC = () => {
  const ctx = useMusicContext();
  const playlist = ctx.playlists[0];
  const playlistId = playlist?.id ?? 'missing-playlist';
  return (
    <>
      <Text testID="probe-current">{ctx.currentSong?.id ?? '-'}</Text>
      <Text testID="probe-playback-queue">
        {ctx.playbackQueue.map(song => song.id).join(',')}
      </Text>
      <Text testID="probe-playback-queue-titles">
        {ctx.playbackQueue.map(song => song.title).join(',')}
      </Text>
      <Text testID="probe-song-s2-title">
        {ctx.songs.find(song => song.id === 's2')?.title ?? '-'}
      </Text>
      <Text testID="probe-song-s2-cover">
        {ctx.songs.find(song => song.id === 's2')?.cover ?? '-'}
      </Text>
      <Text testID="probe-song-s2-track">
        {ctx.songs.find(song => song.id === 's2')?.trackNumber ?? '-'}
      </Text>
      <Text testID="probe-song-s2-disc">
        {ctx.songs.find(song => song.id === 's2')?.discNumber ?? '-'}
      </Text>
      <Text testID="probe-song-s2-comment">
        {ctx.songs.find(song => song.id === 's2')?.comment ?? '-'}
      </Text>
      <Text testID="probe-songs-count">{String(ctx.songs.length)}</Text>
      <Text testID="probe-shuffle">{String(ctx.shuffle)}</Text>
      <Text testID="probe-repeat">{ctx.repeatMode}</Text>
      <Text testID="probe-volume">{String(ctx.volume)}</Text>
      <Text testID="probe-eq">{ctx.eqPreset}</Text>
      <Text testID="probe-eq-band-0">{String(ctx.eqBands[0])}</Text>
      <Text testID="probe-playlists-count">{String(ctx.playlists.length)}</Text>
      <Text testID="probe-playlist-id">{playlist?.id ?? '-'}</Text>
      <Text testID="probe-playlist-name">{playlist?.name ?? '-'}</Text>
      <Text testID="probe-playlist-song-ids">{playlist?.songIds.join(',') ?? '-'}</Text>
      <Text testID="probe-ready">{String(ctx.isReady)}</Text>
      <Pressable testID="set-songs" onPress={() => ctx.setSongs(SONGS)}>
        <Text>set</Text>
      </Pressable>
      <Pressable testID="play-s2" onPress={() => ctx.playSong(SONGS[1], SONGS)}>
        <Text>play s2</Text>
      </Pressable>
      <Pressable
        testID="play-s3-subset"
        onPress={() => ctx.playSong(SONGS[2], [SONGS[2], SONGS[3]])}
      >
        <Text>play s3 subset</Text>
      </Pressable>
      <Pressable testID="play-s3" onPress={() => ctx.playSong(SONGS[2], SONGS)}>
        <Text>play s3</Text>
      </Pressable>
      <Pressable
        testID="play-demo"
        onPress={() =>
          ctx.playSong({
            id: 'demo-1',
            title: 'Demo 1',
            artist: 'Demo',
            uri: 'file:///demo1.mp3',
          })
        }
      >
        <Text>play demo</Text>
      </Pressable>
      <Pressable testID="toggle-shuffle" onPress={() => ctx.toggleShuffle()}>
        <Text>shuffle</Text>
      </Pressable>
      <Pressable testID="next" onPress={() => ctx.next()}>
        <Text>next</Text>
      </Pressable>
      <Pressable testID="previous" onPress={() => ctx.previous()}>
        <Text>previous</Text>
      </Pressable>
      <Pressable testID="apply-rock" onPress={() => ctx.applyEqPreset('rock')}>
        <Text>rock</Text>
      </Pressable>
      <Pressable testID="set-eq-band" onPress={() => ctx.setEqBand(0, 3)}>
        <Text>eq band</Text>
      </Pressable>
      <Pressable testID="create-playlist" onPress={() => ctx.createPlaylist('Roadtrip')}>
        <Text>create playlist</Text>
      </Pressable>
      <Pressable testID="add-song-playlist" onPress={() => ctx.addSongToPlaylist(playlistId, 's2')}>
        <Text>add playlist song</Text>
      </Pressable>
      <Pressable testID="add-song-playlist-again" onPress={() => ctx.addSongToPlaylist(playlistId, 's2')}>
        <Text>add playlist song again</Text>
      </Pressable>
      <Pressable testID="remove-song-playlist" onPress={() => ctx.removeSongFromPlaylist(playlistId, 's2')}>
        <Text>remove playlist song</Text>
      </Pressable>
      <Pressable testID="rename-playlist" onPress={() => ctx.renamePlaylist(playlistId, 'New') }>
        <Text>rename playlist</Text>
      </Pressable>
      <Pressable testID="delete-playlist" onPress={() => ctx.deletePlaylist(playlistId)}>
        <Text>delete playlist</Text>
      </Pressable>
      <Pressable testID="cycle-repeat" onPress={() => ctx.cycleRepeatMode()}>
        <Text>repeat</Text>
      </Pressable>
      <Pressable testID="volume-half" onPress={() => ctx.setVolume(0.5)}>
        <Text>volume</Text>
      </Pressable>
      <Pressable testID="metadata-s2" onPress={() => ctx.updateSongMetadata('s2', { title: 'Song 2 Edited', cover: 'file:///cover-s2-new.jpg' })}>
        <Text>metadata</Text>
      </Pressable>
      <Pressable testID="metadata-s2-rich" onPress={() => ctx.updateSongMetadata('s2', { title: 'Rich', trackNumber: '7/11', discNumber: '2/3', comment: 'Hello' })}>
        <Text>metadata rich</Text>
      </Pressable>
    </>
  );
};

const waitReady = async (getByTestId: ReturnType<typeof render>['getByTestId']) => {
  await waitFor(() => expect(getByTestId('probe-ready').props.children).toBe('true'));
};

const mockTrackPlayer = TrackPlayer as RNTPMock;

describe('MusicContext', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    mockTrackPlayer.__reset();
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  test('hydrates as ready with empty state', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    expect(getByTestId('probe-songs-count').props.children).toBe('0');
  });

  test('setSongs persists songs', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    await waitFor(async () => {
      const stored = await storage.get<Song[]>(StorageKeys.SONGS);
      expect(stored?.length).toBe(4);
    });
  });

  test('playSong builds queue starting at requested song', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));
    expect(getByTestId('probe-playback-queue').props.children).toBe('s2,s3,s4,s1');
    expect(mockTrackPlayer.__getQueue()).toHaveLength(4);
  });

  test('playSong reuses native queue via skip for same queue', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));

    const resetCallsAfterFirstPlay = (TrackPlayer.reset as jest.Mock).mock.calls.length;
    const addCallsAfterFirstPlay = (TrackPlayer.add as jest.Mock).mock.calls.length;

    fireEvent.press(getByTestId('play-s3'));

    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s3'));
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect((TrackPlayer.reset as jest.Mock).mock.calls.length).toBe(resetCallsAfterFirstPlay);
    expect((TrackPlayer.add as jest.Mock).mock.calls.length).toBe(addCallsAfterFirstPlay);
  });

  test('playSong rebuilds native queue for a different queue context', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));

    const resetCallsAfterFirstPlay = (TrackPlayer.reset as jest.Mock).mock.calls.length;
    fireEvent.press(getByTestId('play-s3-subset'));

    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s3'));
    expect((TrackPlayer.reset as jest.Mock).mock.calls.length).toBe(resetCallsAfterFirstPlay + 1);
    expect(getByTestId('probe-playback-queue').props.children).toBe('s3,s4');
  });

  test('toggle play pause pauses and resumes', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(TrackPlayer.play).toHaveBeenCalled());
  });

  test('next and previous do not throw', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));
    fireEvent.press(getByTestId('next'));
    fireEvent.press(getByTestId('previous'));
    await waitFor(() => expect(TrackPlayer.skipToNext).toHaveBeenCalled());
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
  });

  test('repeat cycle persists mode and updates TrackPlayer', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('cycle-repeat'));
    await waitFor(async () => {
      expect(await storage.get(StorageKeys.REPEAT_MODE)).toBe('all');
    });
  });

  test('volume persists and updates TrackPlayer', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('volume-half'));
    await waitFor(() => expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.5));
  });

  test('eq preset and custom band persist', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('apply-rock'));
    await waitFor(() => expect(getByTestId('probe-eq').props.children).toBe('rock'));
    fireEvent.press(getByTestId('set-eq-band'));
    await waitFor(() => expect(getByTestId('probe-eq').props.children).toBe('custom'));
  });

  test('playlist create add rename remove delete flows', async () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(uuid);
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);

    fireEvent.press(getByTestId('create-playlist'));
    await waitFor(() => expect(getByTestId('probe-playlists-count').props.children).toBe('1'));
    expect(getByTestId('probe-playlist-id').props.children).toBe(`pl-${uuid}`);
    expect(getByTestId('probe-playlist-name').props.children).toBe('Roadtrip');

    fireEvent.press(getByTestId('add-song-playlist'));
    fireEvent.press(getByTestId('add-song-playlist-again'));
    await waitFor(() => expect(getByTestId('probe-playlist-song-ids').props.children).toBe('s2'));

    fireEvent.press(getByTestId('rename-playlist'));
    await waitFor(() => expect(getByTestId('probe-playlist-name').props.children).toBe('New'));

    fireEvent.press(getByTestId('remove-song-playlist'));
    await waitFor(() => expect(getByTestId('probe-playlist-song-ids').props.children).toBe(''));

    fireEvent.press(getByTestId('delete-playlist'));
    await waitFor(() => expect(getByTestId('probe-playlists-count').props.children).toBe('0'));
  });

  test('updateSongMetadata updates library and queued metadata', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('play-s2'));
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s2'));
    fireEvent.press(getByTestId('metadata-s2'));
    await waitFor(() => expect(getByTestId('probe-song-s2-title').props.children).toBe('Song 2 Edited'));
    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalled();
  });

  test('updateSongMetadata preserves rich tag fields', async () => {
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('set-songs'));
    fireEvent.press(getByTestId('metadata-s2-rich'));
    await waitFor(() => expect(getByTestId('probe-song-s2-title').props.children).toBe('Rich'));
    expect(getByTestId('probe-song-s2-track').props.children).toBe('7/11');
    expect(getByTestId('probe-song-s2-disc').props.children).toBe('2/3');
    expect(getByTestId('probe-song-s2-comment').props.children).toBe('Hello');
  });

  test('hydration restores persisted songs and current song', async () => {
    await storage.set(StorageKeys.SONGS, SONGS);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 's3');
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    await waitFor(() => expect(getByTestId('probe-current').props.children).toBe('s3'));
    expect(getByTestId('probe-playback-queue').props.children).toBe('s3,s4,s1,s2');
  });

  test('hydration removes invalid persisted current song', async () => {
    await storage.set(StorageKeys.SONGS, SONGS);
    await storage.set(StorageKeys.CURRENT_SONG_ID, 'missing');
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    await waitFor(async () => expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).not.toBe('missing'));
  });

  test('hydration restores settings', async () => {
    await storage.set(StorageKeys.SONGS, SONGS);
    await storage.set(StorageKeys.VOLUME, 0.25);
    await storage.set(StorageKeys.REPEAT_MODE, 'one');
    await storage.set(StorageKeys.SHUFFLE, true);
    await storage.set(StorageKeys.EQ_PRESET, 'rock');
    await storage.set(StorageKeys.EQ_BANDS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    expect(getByTestId('probe-volume').props.children).toBe('0.25');
    expect(getByTestId('probe-repeat').props.children).toBe('one');
    expect(getByTestId('probe-shuffle').props.children).toBe('true');
    expect(getByTestId('probe-eq').props.children).toBe('rock');
  });

  test('playing demo song clears persisted current song id', async () => {
    await storage.set(StorageKeys.SONGS, SONGS);
    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);
    fireEvent.press(getByTestId('play-demo'));
    await waitFor(async () => expect(await storage.get(StorageKeys.CURRENT_SONG_ID)).toBeNull());
  });

  test('hydrates songs by migrating base64 covers before persisting', async () => {
    await storage.set(StorageKeys.SONGS, [{
      id: 'base64-cover',
      title: 'Cover',
      artist: 'Artist',
      uri: 'file:///cover.mp3',
      cover: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    }]);

    const { getByTestId } = render(<MusicProvider><Probe /></MusicProvider>);
    await waitReady(getByTestId);

    await waitFor(async () => {
      const stored = await storage.get<Song[]>(StorageKeys.SONGS);
      expect(stored?.[0]?.cover).toMatch(/^file:\/\/\/docs\/covers\/.+\.png$/);
      expect(stored?.[0]?.cover?.startsWith('data:image/')).toBe(false);
    });
  });
});
