import React from 'react';
import PlaylistsContent from './PlaylistsContent';
import { usePlaylistsScreenState } from './usePlaylistsScreenState';

const Playlists: React.FC = () => {
  const {
    newPlaylistName,
    setNewPlaylistName,
    playlistEntries,
    handleCreatePlaylist,
    handleDeletePlaylist,
    playPlaylist,
  } = usePlaylistsScreenState();

  return (
    <PlaylistsContent
      newPlaylistName={newPlaylistName}
      onChangePlaylistName={setNewPlaylistName}
      onCreatePlaylist={handleCreatePlaylist}
      playlistEntries={playlistEntries}
      onPlayPlaylist={playPlaylist}
      onDeletePlaylist={handleDeletePlaylist}
    />
  );
};

export default Playlists;
