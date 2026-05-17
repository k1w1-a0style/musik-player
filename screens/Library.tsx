import React from 'react';
import { StyleSheet } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import LibraryScreenContent from '../components/LibraryScreenContent';
import { useLibraryController } from '../hooks/libraryHooks';

const Library: React.FC = () => {
  const controller = useLibraryController();

  return (
    <AppBackground>
      <Screen testID="library-screen" contentStyle={styles.container}>
        <LibraryScreenContent {...controller} />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0, paddingTop: 8 },
});

export default Library;
