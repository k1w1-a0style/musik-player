import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { Song } from '../types/Song';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';
import AlbumTile from './AlbumTile';
import type { AlbumGroup } from './coversHelpers';

interface CoversContentProps {
  albums: AlbumGroup[];
  onPressAlbum: (song: Song, queue?: Song[]) => Promise<void>;
}

const CoversContent: React.FC<CoversContentProps> = ({ albums, onPressAlbum }) => (
  <AppBackground>
    <Screen style={styles.container} testID="covers-screen" contentStyle={styles.content}>
      <Text style={styles.eyebrow}>ENTDECKEN</Text>
      <Text style={styles.title}>Cover</Text>
      <FlatList
        data={albums}
        keyExtractor={item => item.name}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <AlbumTile album={item} onPressAlbum={onPressAlbum} />}
        removeClippedSubviews
        windowSize={5}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={80}
        ListEmptyComponent={
          <Text style={styles.empty} testID="covers-empty">
            Keine Alben in der Bibliothek.
          </Text>
        }
      />
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingTop: 8 },
  eyebrow: {
    color: theme.palette.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: theme.fonts.body,
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.display,
    letterSpacing: -1.0,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
  columnWrapper: { gap: theme.spacing.md },
  listContent: { gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  empty: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontFamily: theme.fonts.body,
  },
});

export default CoversContent;
