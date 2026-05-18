import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useMusicProviderState } from '../useMusicProviderState';

const StateProbe = () => {
  const {
    isReady,
    setIsReady,
    songs,
    setSongsState,
    currentSong,
    setCurrentSong,
    playbackQueue,
    setPlaybackQueue,
    playlists,
    setPlaylists,
    shuffle,
    setShuffle,
  } = useMusicProviderState();

  return (
    <>
      <Text testID="ready">{String(isReady)}</Text>
      <Text testID="songs">{songs.length}</Text>
      <Text testID="current">{currentSong?.id ?? ''}</Text>
      <Text testID="queue">{playbackQueue.length}</Text>
      <Text testID="playlists">{playlists.length}</Text>
      <Text testID="shuffle">{String(shuffle)}</Text>
      <Button testID="hydrate" title="hydrate" onPress={() => {
        setIsReady(true);
        setSongsState([{ id: 's1', title: 'One', artist: 'A' }]);
        setCurrentSong({ id: 's1', title: 'One', artist: 'A' });
        setPlaybackQueue([{ id: 's1', title: 'One', artist: 'A' }]);
        setPlaylists([{ id: 'pl-1', name: 'List', songIds: ['s1'], createdAt: 1 }]);
        setShuffle(true);
      }} />
    </>
  );
};

describe('useMusicProviderState', () => {
  test('owns core provider state and setters', () => {
    const { getByTestId } = render(<StateProbe />);

    expect(getByTestId('ready').props.children).toBe('false');
    expect(getByTestId('songs').props.children).toBe(0);
    expect(getByTestId('current').props.children).toBe('');
    expect(getByTestId('queue').props.children).toBe(0);
    expect(getByTestId('playlists').props.children).toBe(0);
    expect(getByTestId('shuffle').props.children).toBe('false');

    act(() => fireEvent.press(getByTestId('hydrate')));

    expect(getByTestId('ready').props.children).toBe('true');
    expect(getByTestId('songs').props.children).toBe(1);
    expect(getByTestId('current').props.children).toBe('s1');
    expect(getByTestId('queue').props.children).toBe(1);
    expect(getByTestId('playlists').props.children).toBe(1);
    expect(getByTestId('shuffle').props.children).toBe('true');
  });
});
