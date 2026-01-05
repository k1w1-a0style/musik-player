import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MusicPlayerControls = () => {
  return (
    <View style={styles.container}>
      <Text>Music Player Controls</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
  },
});

export default MusicPlayerControls;