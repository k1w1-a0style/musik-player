import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Song } from '../types/Song';
import { theme as staticTheme } from '../theme';
import AlbumTile from './AlbumTile';
import type { AlbumGroup } from './coversHelpers';

interface CoversContentProps {
  albums: AlbumGroup[];
  onPressAlbum: (song: Song, queue?: Song[]) => Promise<void>;
}

const CoversContent: React.FC<CoversContentProps> = ({ albums, onPressAlbum }) => {
  const { theme } = useAppTheme();

  return (
    <AppBackground>
      <Screen style={styles.container} testID="covers-screen" contentStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: theme.palette.primary }]}>ENTDECKEN</Text>
        <Text style={[styles.title, { color: theme.palette.text.primary }]}>Cover</Text>
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
            <Text style={[styles.empty, { color: theme.palette.text.secondary }]} testID="covers-empty">
              Keine Alben in der Bibliothek.
            </Text>
          }
        />
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: staticTheme.spacing.md, paddingTop: 8 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: staticTheme.fonts.body,
  },
  title: {
    fontSize: 32,
    fontFamily: staticTheme.fonts.display,
    letterSpacing: -1.0,
    marginBottom: staticTheme.spacing.md,
  },
  columnWrapper: { gap: staticTheme.spacing.md },
  listContent: { gap: staticTheme.spacing.md, paddingBottom: staticTheme.spacing.xxl },
  empty: {
    textAlign: 'center',
    marginTop: staticTheme.spacing.xl,
    fontFamily: staticTheme.fonts.body,
  },
});

export default CoversContent;
