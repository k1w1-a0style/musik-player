import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { theme } from '../theme';
import { displayArtist, normalizeLibraryText } from '../utils/libraryPresentation';

interface NowPlayingTitleRowProps {
  currentSong: Song | null;
  favorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
}

const NowPlayingTitleRow: React.FC<NowPlayingTitleRowProps> = ({
  currentSong,
  favorite,
  favoritePending,
  onToggleFavorite,
}) => {
  const title = normalizeLibraryText(currentSong?.title) || 'Kein Titel ausgewählt';
  const artist = currentSong ? displayArtist(currentSong) : 'Wähle einen Song aus der Bibliothek';

  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
      </View>
      <Pressable
        disabled={favoritePending}
        onPress={onToggleFavorite}
        style={styles.heartBtn}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Titel ist Favorit — tippen zum Entfernen' : 'Titel favorisieren'}
        accessibilityState={{ disabled: favoritePending, checked: favorite }}
      >
        <Heart
          color={favorite ? theme.palette.primary : theme.palette.text.primary}
          fill={favorite ? theme.palette.primary : 'transparent'}
          size={22}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: theme.palette.text.primary, fontSize: 21, letterSpacing: -0.55, fontFamily: theme.fonts.display },
  artist: { color: theme.palette.text.secondary, fontSize: 13, marginTop: 2, fontFamily: theme.fonts.body },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

export default NowPlayingTitleRow;
