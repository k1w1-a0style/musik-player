import React from 'react';
import { View, Text, FlatList } from 'react-native';
export function MusicLibraryScreen() {
  const [library, setLibrary] = React.useState([]);
  return (
    <View>
      <Text>Music Library Screen</Text>
      <FlatList data={library} renderItem={({ item }) => <Text>{item}</Text>} />
    </View>
  );
}