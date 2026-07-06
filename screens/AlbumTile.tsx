import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { Song } from '../types/Song';
import { theme as staticTheme } from '../theme';
import { formatAlbumSongCount, type AlbumGroup } from './coversHelpers';

interface AlbumTileProps {
  album: AlbumGroup;
  onPressAlbum: (song: Song, queue?: Song[]) => Promise<void>;
}

const AlbumTile = React.memo<AlbumTileProps>(({ album, onPressAlbum }) => {
  const { theme } = useAppTheme();
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
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {showCover ? (
        <Image
          source={{ uri: album.artworkUri }}
          style={[styles.image, { backgroundColor: theme.palette.surfaceElevated }]}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={[styles.image, styles.placeholder, { backgroundColor: theme.palette.surfaceElevated }]}>
          <Disc3 color={theme.palette.primary} size={48} strokeWidth={1.2} />
        </View>
      )}
      <Text style={[styles.tileTitle, { color: theme.palette.text.primary }]} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={[styles.tileMeta, { color: theme.palette.text.secondary }]}>
        {formatAlbumSongCount(album.songs.length)}
      </Text>
    </Pressable>
  );
});

AlbumTile.displayName = 'AlbumTile';

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: staticTheme.borderRadius.md,
    padding: staticTheme.spacing.sm,
    borderWidth: 1,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: staticTheme.borderRadius.sm,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontFamily: staticTheme.fonts.heading,
    fontSize: 14,
    marginTop: staticTheme.spacing.sm,
  },
  tileMeta: {
    fontSize: 12,
    fontFamily: staticTheme.fonts.body,
  },
});

export default AlbumTile;
