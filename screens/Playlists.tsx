import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  useEffect(() => {
    // Load playlists from storage
    setPlaylists([
      { id: 1, name: 'Playlist 1' },
      { id: 2, name: 'Playlist 2' },
      { id: 3, name: 'Playlist 3' },
    ]);
  }, []);

  const handleSelectPlaylist = (playlist) => {
    setSelectedPlaylist(playlist);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playlists</Text>
      <FlatList
        data={playlists}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelectPlaylist(item)}>
            <Text style={styles.playlistName}>{item.name}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
  playlistName: {
    fontSize: 18,
    color: theme.palette.text.primary,
    padding: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
});

export default Playlists;
