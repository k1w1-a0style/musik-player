import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { formatAlbumSongCount, type AlbumGroup } from './coversHelpers';

interface AlbumTileProps {
  album: AlbumGroup;
  onPressAlbum: (song: Song, queue?: Song[]) => Promise<void>;
}

const AlbumTile = React.memo<AlbumTileProps>(({ album, onPressAlbum }) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = !!album.artworkUri && !coverFailed;

  useEffect(() => {
    setCoverFailed(false);
  }, [album.artworkUri]);

  return (
    <Pressable
      testID={`cover-tile-${album.name}`}
      accessibilityRole="button"
      accessibilityLabel={`Album ${album.name} abspielen`}
      onPress={() => {
        if (album.songs[0]) void onPressAlbum(album.songs[0], album.songs);
      }}
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
      <Text style={styles.tileMeta}>{formatAlbumSongCount(album.songs.length)}</Text>
    </Pressable>
  );
});

AlbumTile.displayName = 'AlbumTile';

const styles = StyleSheet.create({
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
});

export default AlbumTile;
