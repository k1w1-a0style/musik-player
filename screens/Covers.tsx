import React from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { useMusicContext } from '../contexts/MusicContext';
import { theme } from '../theme';

const Covers: React.FC = () => {
  const { songs, playSong } = useMusicContext();

  const withAlbum = songs.reduce<Record<string, typeof songs>>((acc, s) => {
    const key = s.album ?? 'Unbekannt';
    (acc[key] ||= []).push(s);
    return acc;
  }, {});
  const albums = Object.entries(withAlbum);

  return (
    <View style={styles.container} testID="covers-screen">
      <Text style={styles.title}>Cover</Text>
      <FlatList
        data={albums}
        keyExtractor={([name]) => name}
        numColumns={2}
        columnWrapperStyle={{ gap: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
        renderItem={({ item: [name, list] }) => (
          <View style={styles.tile} testID={`cover-tile-${name}`}>
            {list[0]?.cover ? (
              <Image source={{ uri: list[0].cover }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.placeholder]}>
                <Text style={styles.placeholderIcon}>♫</Text>
              </View>
            )}
            <Text style={styles.tileTitle} numberOfLines={1}>{name}</Text>
            <Text style={styles.tileMeta}>{list.length} Titel</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Keine Alben in der Bibliothek.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background, padding: theme.spacing.md },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.md,
  },
  tile: {
    flex: 1,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.palette.cardElevated,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { color: theme.palette.primary, fontSize: 48 },
  tileTitle: {
    color: theme.palette.text.primary,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  tileMeta: { color: theme.palette.text.secondary, fontSize: 12 },
  empty: { color: theme.palette.text.secondary, textAlign: 'center', marginTop: theme.spacing.xl },
});

export default Covers;
