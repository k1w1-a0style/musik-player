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

type RNTPMock = typeof TrackPlayer & {
  __reset: () => void;
  __getQueue: () => unknown[];
};

const SONGS: Song[] = [
  { id: 's1', title: 'Song 1', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Song 2', artist: 'A', uri: 'file:///s2.mp3' },
  { id: 's3', title: 'Song 3', artist: 'B', uri: 'file:///s3.mp3' },
];

const Probe: React.FC = () => {
  const ctx = useMusicContext();
  return (
    <>
      <Text testID="probe-current">{ctx.currentSong?.id ?? '-'}</Text>
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


  test('hydrates songs by migrating base64 covers before persisting', async () => {
    await storage.set(StorageKeys.SONGS, [
      { id: 's1', title: 'Song 1', artist: 'A', uri: 'file:///s1.mp3', cover: 'data:image/png;base64,AAAA' },
    ]);

    const { getByTestId } = renderProvider();
    await waitReady(getByTestId);

    await waitFor(async () => {
      const stored = await storage.get<Song[]>(StorageKeys.SONGS);
      expect(stored?.[0]?.cover).toBe('file:///docs/covers/s1.png');
      expect(stored?.[0]?.cover?.startsWith('data:image/')).toBe(false);
    });
  });

});
