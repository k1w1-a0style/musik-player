import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import type { Song } from '../types/Song';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
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
    <View style={styles.titleRow} testID="now-playing-title-row">
      <View style={styles.titleBlock} testID="now-playing-title-block">
        <Text style={[styles.title, { color: theme.palette.text.primary }]} numberOfLines={2}
          testID="now-playing-title-text">{title}</Text>
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
  titleRow: { height: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  titleBlock: { flex: 1, minWidth: 0, height: 62 },
  title: { height: 44, lineHeight: 22, fontSize: 21, letterSpacing: -0.55,
    fontFamily: APP_THEME_TOKENS.fonts.display },
  artist: { height: 16, lineHeight: 16, fontSize: 13, marginTop: 2,
    fontFamily: APP_THEME_TOKENS.fonts.body },
  heartBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(NowPlayingTitleRow);
