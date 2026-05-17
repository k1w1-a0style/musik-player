import React from 'react';
import { StyleSheet } from 'react-native';
import AppBackground from './AppBackground';
import Screen from './Screen';

interface LibraryScreenFrameProps {
  children: React.ReactNode;
}

const LibraryScreenFrame: React.FC<LibraryScreenFrameProps> = ({ children }) => (
  <AppBackground>
    <Screen testID="library-screen" contentStyle={styles.container}>
      {children}
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
});

export default LibraryScreenFrame;
