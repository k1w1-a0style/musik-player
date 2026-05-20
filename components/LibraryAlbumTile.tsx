import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import type { LibraryGroupItem } from '../utils/libraryPresentation';

interface LibraryAlbumTileProps {
  album: LibraryGroupItem;
  onPress: (album: LibraryGroupItem) => void;
}

export const getAlbumTileFallbackLetter = (title: string): string =>
  title.trim().slice(0, 1).toUpperCase() || '?';

const LibraryAlbumTile: React.FC<LibraryAlbumTileProps> = ({ album, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${album.title} abspielen`}
    style={({ pressed }) => [styles.albumTile, pressed && styles.pressed]}
    onPress={() => onPress(album)}
    testID={`library-album-tile-${album.id}`}
  >
    <View style={styles.albumArt}>
      {album.cover ? (
        <Image source={{ uri: album.cover }} style={styles.albumImage} testID={`library-album-cover-${album.id}`} />
      ) : (
        <Text style={styles.albumLetter}>{getAlbumTileFallbackLetter(album.title)}</Text>
      )}
    </View>
    <Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text>
    <Text style={styles.albumSubtitle}>{album.subtitle}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  albumTile: { width: '48%', height: 184, marginBottom: 14 },
  albumArt: { aspectRatio: 1, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  albumImage: { width: '100%', height: '100%' },
  albumLetter: { color: theme.palette.primary, fontFamily: theme.fonts.heading, fontSize: 34 },
  albumTitle: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 13, marginTop: 7, lineHeight: 17 },
  albumSubtitle: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.72 },
});

export default LibraryAlbumTile;
