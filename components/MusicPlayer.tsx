import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MusicPlayer: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text>Music Player</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0'
  }
});

export default MusicPlayer;
