import React, { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import TrackPlayer, { Event } from 'react-native-track-player';
import { findTrackSongById, useCurrentSongSync } from '../useCurrentSongSync';
import type { Song } from '../../types/Song';

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
    jest.clearAllMocks();
  });

  test('finds tracks across library, queue and base queue sources', () => {
    expect(findTrackSongById('s1', [[librarySong], [queueSong]])).toBe(librarySong);
    expect(findTrackSongById('s2', [[librarySong], [queueSong]])).toBe(queueSong);
    expect(findTrackSongById(undefined, [[librarySong]])).toBeUndefined();
    expect(findTrackSongById('missing', [[librarySong]])).toBeUndefined();
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

  test('ignores unknown active track ids', () => {
    const persistCurrentSongId = jest.fn(async () => undefined);
    const { getByTestId } = render(<SyncProbe persistCurrentSongId={persistCurrentSongId} />);

    act(() => {
      trackPlayerMock.__trigger(Event.PlaybackActiveTrackChanged, { track: { id: 'missing' } });
    });

    expect(getByTestId('current').props.children).toBe('');
    expect(persistCurrentSongId).not.toHaveBeenCalled();
  });
});
