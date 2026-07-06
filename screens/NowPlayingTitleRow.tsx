import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';
import { displayArtist, displayTitle } from '../utils/libraryPresentation';

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
  const { theme } = useAppTheme();
  const title = currentSong ? displayTitle(currentSong) : 'Kein Titel ausgewählt';
  const artist = currentSong ? displayArtist(currentSong) : 'Wähle einen Titel aus der Bibliothek';

  return (
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.palette.text.primary }]} numberOfLines={2}>{title}</Text>
        <Text style={[styles.artist, { color: theme.palette.text.secondary }]} numberOfLines={1}>{artist}</Text>
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
  title: { fontSize: 21, letterSpacing: -0.55, fontFamily: staticTheme.fonts.display },
  artist: { fontSize: 13, marginTop: 2, fontFamily: staticTheme.fonts.body },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

export default NowPlayingTitleRow;
