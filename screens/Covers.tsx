import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import { useMusicContext } from '../contexts/MusicContext';
import AppBackground from '../components/AppBackground';
import type { Song } from '../types/Song';
import { theme } from '../theme';

const Covers: React.FC = () => {
  const { songs, playSong } = useMusicContext();

  const withAlbum = songs.reduce<Record<string, Song[]>>((acc, s) => {
    const key = s.album ?? 'Unbekannt';
    (acc[key] ||= []).push(s);
    return acc;
  }, {});
  const albums = Object.entries(withAlbum);

  return (
    <AppBackground>
      <View style={styles.container} testID="covers-screen">
        <Text style={styles.eyebrow}>ENTDECKEN</Text>
        <Text style={styles.title}>Cover</Text>
        <FlatList
          data={albums}
          keyExtractor={([name]) => name}
          numColumns={2}
          columnWrapperStyle={{ gap: theme.spacing.md }}
          contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
          renderItem={({ item: [name, list] }) => (
            <Pressable
              testID={`cover-tile-${name}`}
              accessibilityRole="button"
              accessibilityLabel={`Album ${name} abspielen`}
              onPress={() => list[0] && playSong(list[0], list)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              {list[0]?.cover ? (
                <Image source={{ uri: list[0].cover }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Disc3 color={theme.palette.primary} size={48} strokeWidth={1.2} />
                </View>
              )}
              <Text style={styles.tileTitle} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.tileMeta}>
                {list.length} {list.length === 1 ? 'Titel' : 'Titel'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty} testID="covers-empty">
              Keine Alben in der Bibliothek.
            </Text>
          }
        />
      </View>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md },
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
