import React from 'react';
import { View, Text } from 'react-native';
import { useMusicContext } from '../src/contexts/MusicContext';

const MusicPlayer: React.FC = () => {
  const { currentSong } = useMusicContext();

  return (
    <View>
      <Text>Now Playing: {currentSong.title}</Text>
    </View>
  );
};

export default MusicPlayer;
