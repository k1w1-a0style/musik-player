import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { getSongArtworkUri } from '../utils/songArtwork';

interface AlbumGroup {
  name: string;
  songs: Song[];
  artworkUri?: string;
}

const UNKNOWN_ALBUM = 'Unbekannt';

const buildAlbumGroups = (songs: Song[]): AlbumGroup[] => {
  const grouped = songs.reduce<Record<string, Song[]>>((acc, song) => {
    const key = song.album?.trim() || UNKNOWN_ALBUM;
    (acc[key] ||= []).push(song);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, list]) => ({
      name,
      songs: list,
      artworkUri: list.map(getSongArtworkUri).find(Boolean),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const Covers: React.FC = () => {
  const { songs, playSong } = useMusicContext();
  const albums = useMemo(() => buildAlbumGroups(songs), [songs]);

  return (
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
          renderItem={({ item }) => (
            <AlbumTile album={item} onPressAlbum={playSong} />
          )}
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
};

interface AlbumTileProps {
  album: AlbumGroup;
  onPressAlbum: (song: Song, queue?: Song[]) => Promise<void>;
}

const AlbumTile = React.memo<AlbumTileProps>(({ album, onPressAlbum }) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = !!album.artworkUri && !coverFailed;

  React.useEffect(() => {
    setCoverFailed(false);
  }, [album.artworkUri]);

  return (
    <Pressable
      testID={`cover-tile-${album.name}`}
      accessibilityRole="button"
      accessibilityLabel={`Album ${album.name} abspielen`}
      onPress={() => album.songs[0] && onPressAlbum(album.songs[0], album.songs)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {showCover ? (
        <Image
          source={{ uri: album.artworkUri }}
          style={styles.image}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Disc3 color={theme.palette.primary} size={48} strokeWidth={1.2} />
        </View>
      )}
      <Text style={styles.tileTitle} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={styles.tileMeta}>
        {album.songs.length} {album.songs.length === 1 ? 'Titel' : 'Titel'}
      </Text>
    </Pressable>
  );
});

AlbumTile.displayName = 'AlbumTile';

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
  tile: {
    flex: 1,
    backgroundColor: theme.palette.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.palette.surfaceElevated,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    color: theme.palette.text.primary,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    marginTop: theme.spacing.sm,
  },
  tileMeta: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  empty: {
    color: theme.palette.text.secondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontFamily: theme.fonts.body,
  },
});

export default Covers;
