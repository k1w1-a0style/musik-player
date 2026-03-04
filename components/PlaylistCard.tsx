import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PlaylistCard: React.FC<{ playlist: any }> = ({ playlist }) => {
  return (
    <View style={styles.container}>
      <Text>{playlist.name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});

export default PlaylistCard;
