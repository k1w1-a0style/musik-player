import React, { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import TrackPlayer, { Event } from 'react-native-track-player';
import { findTrackSongById, useCurrentSongSync } from '../useCurrentSongSync';
import { normalizeActiveTrackId } from '../currentSongSyncHelpers';
import type { Song } from '../../types/Song';
import { acquireNativeHydrationGate, publishNativeHydrationGate, resetNativeHydrationGateForTests } from '../../utils/nativeHydrationGate';

const librarySong: Song = { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' };
const queueSong: Song = { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' };
const baseQueueSong: Song = { id: 's3', title: 'Three', artist: 'C', uri: 'file:///s3.mp3' };

type TrackPlayerMock = typeof TrackPlayer & {
  __trigger: (event: string, payload: unknown) => void;
};

const trackPlayerMock = TrackPlayer as TrackPlayerMock;

const SyncProbe = ({ persistCurrentSongId }: { persistCurrentSongId: (song: Song | null) => Promise<void> }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const songsRef = useRef<Song[]>([librarySong]);
  const queueContextRef = useRef<Song[]>([queueSong]);
  const baseQueueContextRef = useRef<Song[]>([baseQueueSong]);
  const persist = useCallback(persistCurrentSongId, [persistCurrentSongId]);

  useCurrentSongSync({
    songsRef,
    queueContextRef,
    baseQueueContextRef,
    setCurrentSong,
    persistCurrentSongId: persist,
  });

  return <Text testID="current">{currentSong?.id ?? ''}</Text>;
};

describe('useCurrentSongSync', () => {
  beforeEach(() => {
    resetNativeHydrationGateForTests();
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, 'ready');
    jest.clearAllMocks();
  });

  test('normalizes active track ids', () => {
    expect(normalizeActiveTrackId(' s1 ')).toBe('s1');
    expect(normalizeActiveTrackId(42)).toBe('42');
    expect(normalizeActiveTrackId('   ')).toBeUndefined();
    expect(normalizeActiveTrackId(Number.NaN)).toBeUndefined();
  });

  test('finds tracks across library, queue and base queue sources', () => {
    expect(findTrackSongById('s1', [[librarySong], [queueSong]])).toBe(librarySong);
    expect(findTrackSongById('s2', [[librarySong], [queueSong]])).toBe(queueSong);
    expect(findTrackSongById(undefined, [[librarySong]])).toBeUndefined();
    expect(findTrackSongById('missing', [[librarySong]])).toBeUndefined();
  });

  test('finds tracks by normalized ids', () => {
    const dirtySong = { ...librarySong, id: ' s1 ' };

    expect(findTrackSongById('s1', [[dirtySong]])).toBe(dirtySong);
    expect(findTrackSongById(' s1 ', [[librarySong]])).toBe(librarySong);
  });

  test('syncs current song when active track changes', () => {
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: 's2' } });
    });

    expect(getByTestId('current').props.children).toBe('s2');
    expect(persistCurrentSongId).toHaveBeenCalledWith(queueSong);
  });

  test.each(['loading', 'degraded', 'retry-required'] as const)('ignores active-track persistence while gate is %s', status => {
    const owner = acquireNativeHydrationGate();
    publishNativeHydrationGate(owner, status);
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);
    act(() => trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: null }));
    act(() => trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: 's2' } }));
    expect(getByTestId('current').props.children).toBe('');
    expect(persistCurrentSongId).not.toHaveBeenCalled();
  });

  test('syncs current song for active track id with surrounding whitespace', () => {
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: ' s2 ' } });
    });

    expect(getByTestId('current').props.children).toBe('s2');
    expect(persistCurrentSongId).toHaveBeenCalledWith(queueSong);
  });

  test('clears persisted current song for unknown active track ids', () => {
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: 'missing' } });
    });

    expect(getByTestId('current').props.children).toBe('');
    expect(persistCurrentSongId).toHaveBeenCalledWith(null);
  });

  test('ignores active-track events without a track or trackId payload and keeps current song', () => {
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: 's1' } });
    });
    expect(getByTestId('current').props.children).toBe('s1');

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { index: 0 });
    });

    expect(getByTestId('current').props.children).toBe('s1');
    expect(persistCurrentSongId).toHaveBeenCalledTimes(1);
  });

  test('removes active-track listener on unmount', () => {
    const remove = jest.fn();
    (TrackPlayer.addEventListener as jest.Mock).mockReturnValueOnce({ remove });
    const persistCurrentSongId = jest.fn(async () => undefined);

    const { unmount } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);
    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });

});
