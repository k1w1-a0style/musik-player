import { buildMusicProviderContextActionsInput } from '../musicProviderActionInput';

const noop = () => undefined;
const noopAsync = async () => undefined;

describe('musicProviderActionInput', () => {
  test('builds context action input sections', () => {
    const actions = {
      setSongs: noop,
      addSongs: noop,
      updateSongMetadata: noop,
  applySongMetadataPatches: noop,
      createPlaylist: () => ({ id: 'pl-1', name: 'List', songIds: [], createdAt: 1, updatedAt: 1 }),
      saveQueueAsPlaylist: () => ({ id: 'pl-2', name: 'Queue', songIds: ['s1'], createdAt: 2, updatedAt: 2 }),
      deletePlaylist: noop,
      renamePlaylist: noop,
      addSongToPlaylist: noop,
      removeSongFromPlaylist: noop,
      playPlaylist: noopAsync,
    };

    expect(buildMusicProviderContextActionsInput(actions)).toEqual({
      library: {
        setSongs: actions.setSongs,
        addSongs: actions.addSongs,
        updateSongMetadata: actions.updateSongMetadata,
        applySongMetadataPatches: actions.applySongMetadataPatches,
      },
      playlists: {
        createPlaylist: actions.createPlaylist,
        saveQueueAsPlaylist: actions.saveQueueAsPlaylist,
        deletePlaylist: actions.deletePlaylist,
        renamePlaylist: actions.renamePlaylist,
        addSongToPlaylist: actions.addSongToPlaylist,
        removeSongFromPlaylist: actions.removeSongFromPlaylist,
        playPlaylist: actions.playPlaylist,
      },
    });
  });
});
