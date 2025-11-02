import React from 'react';
import { View, Text, FlatList } from 'react-native';
export function PlaylistScreen() {
  const [playlist, setPlaylist] = React.useState([]);
  return (
    <View>
      <Text>Playlist Screen</Text>
      <FlatList data={playlist} renderItem={({ item }) => <Text>{item}</Text>} />
    </View>
  );
}