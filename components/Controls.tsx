import React from 'react';
import { View, Text } from 'react-native';
import { useMusicContext } from '../src/contexts/MusicContext';

const Controls: React.FC = () => {
  const { isPlaying, togglePlayPause } = useMusicContext();

  return (
    <View>
      <Text onPress={togglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</Text>
    </View>
  );
};

export default Controls;
