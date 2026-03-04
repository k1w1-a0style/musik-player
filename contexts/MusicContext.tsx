import React, { createContext, useContext, useState } from 'react';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MusicContext = createContext(null);

export const MusicProvider: React.FC = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);

  const playSong = async (song) => {
    // Play song logic
  };

  return (
    <MusicContext.Provider value={{ currentSong, playSong }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusicContext = () => useContext(MusicContext);
