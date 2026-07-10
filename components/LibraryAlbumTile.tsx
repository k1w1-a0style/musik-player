import React, { memo, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import type { LibraryGroupItem } from '../utils/libraryPresentation';

interface LibraryAlbumTileProps {
  album: LibraryGroupItem;
  onPress: (album: LibraryGroupItem) => void;
}

export const getAlbumTileFallbackLetter = (title: string): string =>
  title.trim().slice(0, 1).toUpperCase() || '?';

const LibraryAlbumTileComponent: React.FC<LibraryAlbumTileProps> = ({ album, onPress }) => {
  const { theme } = useAppTheme();
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [album.cover, album.id]);

  const handlePress = useCallback(() => {
    onPress(album);
  }, [album, onPress]);

  const handleCoverError = useCallback(() => {
    setCoverFailed(true);
  }, []);

  const showCover = !!album.cover && !coverFailed;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${album.title} abspielen`}
      style={({ pressed }) => [styles.albumTile, pressed && styles.pressed]}
      onPress={handlePress}
      testID={`library-album-tile-${album.id}`}
    >
      <View
        style={[
          styles.albumArt,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
        ]}
        testID={`library-album-art-${album.id}`}
      >
        {showCover ? (
          <Image source={{ uri: album.cover }} style={styles.albumImage} testID={`library-album-cover-${album.id}`} onError={handleCoverError} />
        ) : (
          <Text style={[styles.albumLetter, { color: theme.palette.primary }]}>{getAlbumTileFallbackLetter(album.title)}</Text>
        )}
      </View>
      <Text style={[styles.albumTitle, { color: theme.palette.text.primary }]} numberOfLines={2}>
        {album.title}
      </Text>
      <Text style={[styles.albumSubtitle, { color: theme.palette.text.secondary }]}>
        {album.subtitle}
      </Text>
    </Pressable>
  );
};

const LibraryAlbumTile = memo(LibraryAlbumTileComponent);

const styles = StyleSheet.create({
  albumTile: { width: '48%', height: 184, marginBottom: 14 },
  albumArt: {
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  albumImage: { width: '100%', height: '100%' },
  albumLetter: { fontFamily: staticTokens.fonts.heading, fontSize: 34 },
  albumTitle: { fontFamily: staticTokens.fonts.heading, fontSize: 13, marginTop: 7, lineHeight: 17 },
  albumSubtitle: { fontFamily: staticTokens.fonts.body, fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.72 },
});

export default LibraryAlbumTile;
