import React, { useRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { usePersistedSetting } from '../usePersistedSetting';
import { usePersistedSongs } from '../usePersistedSongs';
import { StorageKeys, storage } from '../../utils/storage';
import type { Song } from '../../types/Song';

jest.mock('../musicPersistenceHelpers', () => ({
  persistIfChanged: jest.fn(async () => undefined),
  prepareSongsForPersistence: jest.fn(async (songs: Song[]) => ({
    sanitizedSongs: songs,
    coversChanged: false,
  })),
}));

const helpers = jest.requireMock('../musicPersistenceHelpers') as {
  persistIfChanged: jest.Mock;
  prepareSongsForPersistence: jest.Mock;
};

const songs: Song[] = [{ id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' }];

const PersistedSettingProbe = ({ ready = true }: { ready?: boolean }) => {
  const refs = useRef<Record<string, string>>({});
  usePersistedSetting(ready, StorageKeys.VOLUME, 0.5, refs);
  return null;
};

const PersistedSongsProbe = ({
  ready = true,
  setSongsState = jest.fn(),
}: {
  ready?: boolean;
  setSongsState?: (items: Song[]) => void;
}) => {
  const refs = useRef<Record<string, string>>({});
  usePersistedSongs(ready, songs, setSongsState, refs);
  return null;
};

describe('persisted hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('usePersistedSetting persists only when provider is ready', async () => {
    render(<PersistedSettingProbe ready={false} />);
    await waitFor(() => expect(helpers.persistIfChanged).not.toHaveBeenCalled());

    render(<PersistedSettingProbe ready />);
    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledWith(StorageKeys.VOLUME, 0.5, {}));
  });

  test('usePersistedSetting swallows async persistence rejection', async () => {
    helpers.persistIfChanged.mockRejectedValueOnce(new Error('persist rejected'));

    render(<PersistedSettingProbe ready />);

    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledTimes(1));
  });

  test('usePersistedSongs persists sanitized songs', async () => {
    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(helpers.prepareSongsForPersistence).toHaveBeenCalledWith(songs));
    await waitFor(() => expect(helpers.persistIfChanged).toHaveBeenCalledWith(StorageKeys.SONGS, songs, {}));
  });

  test('usePersistedSongs updates state when cover cache sanitizing changed songs', async () => {
    const sanitized = [{ ...songs[0], cover: 'file:///cached-cover.jpg' }];
    const setSongsState = jest.fn();
    helpers.prepareSongsForPersistence.mockResolvedValueOnce({ sanitizedSongs: sanitized, coversChanged: true });

    render(<PersistedSongsProbe ready setSongsState={setSongsState} />);

    await waitFor(() => expect(setSongsState).toHaveBeenCalledWith(sanitized));
    expect(helpers.persistIfChanged).not.toHaveBeenCalled();
  });

  test('usePersistedSongs swallows prepare or persist errors', async () => {
    helpers.prepareSongsForPersistence.mockRejectedValueOnce(new Error('prepare rejected'));

    render(<PersistedSongsProbe ready />);

    await waitFor(() => expect(helpers.prepareSongsForPersistence).toHaveBeenCalledTimes(1));
  });
});
