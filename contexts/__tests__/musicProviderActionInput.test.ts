import {
  buildMusicProviderContextLibraryInput,
  buildMusicProviderContextPlaylistInput,
} from '../musicProviderActionInput';

const noop = () => undefined;
const noopAsync = async () => undefined;

describe('musicProviderActionInput', () => {
  test('builds context library action input', () => {
    const actions = {
      setSongs: noop,
      addSongs: noop,
      updateSongMetadata: noop,
    };

    expect(buildMusicProviderContextLibraryInput(actions)).toEqual(actions);
  });

  test('builds context playlist action input', () => {
    const actions = {
      createPlaylist: () => ({ id: 'pl-1', name: 'List', songIds: [], createdAt: 1 }),
      deletePlaylist: noop,
      renamePlaylist: noop,
      addSongToPlaylist: noop,
      removeSongFromPlaylist: noop,
      playPlaylist: noopAsync,
    };

    expect(buildMusicProviderContextPlaylistInput(actions)).toEqual(actions);
  });
});
