import React, { createContext, useContext } from 'react';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MusicContext = createContext(null);

export const useMusicContext = () => useContext(MusicContext);

// ...implement context provider...
