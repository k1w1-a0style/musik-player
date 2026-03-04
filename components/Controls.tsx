import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMusicContext } from '../src/contexts/MusicContext';

const Controls: React.FC = () => {
  const { isPlaying, togglePlayPause } = useMusicContext();

  return (
    <View style={styles.container}>
      <Text onPress={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Controls;
