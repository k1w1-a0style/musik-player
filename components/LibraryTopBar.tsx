import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreVertical, Search, Sparkles, X } from 'lucide-react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { KIWI_MUSIC_ARTWORK } from '../utils/songArtwork';
import { useAppTheme } from '../contexts/AppThemeContext';

export interface LibraryTopBarProps {
  activity?: React.ReactNode;
  title?: string;
  searchOpen?: boolean;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
  onOpenCleaner?: () => void;
  cleanerDisabled?: boolean;
}

const LibraryTopBar: React.FC<LibraryTopBarProps> = ({
  activity,
  title = 'K1W1 Music',
  searchOpen = false,
  onToggleSearch,
  onOpenMenu,
  onOpenCleaner,
  cleanerDisabled = false,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.topBar} testID="library-top-bar">
      <View style={styles.brandRow}>
        <View style={{ width: 38, height: 38 }}>
        <View pointerEvents="none"><Image source={KIWI_MUSIC_ARTWORK} style={[styles.brandLogo, { borderColor: theme.palette.borderStrong }]}
          fadeDuration={0} accessible={false} /></View>
        {activity}
        </View>
        <View style={styles.brandText}>
          <Text numberOfLines={1} style={[styles.brand, { color: theme.palette.text.primary }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.brandCaption, { color: theme.palette.text.muted }]}>MUSIKBIBLIOTHEK</Text>
        </View>
      </View>
      <View style={styles.topActions}>
        {onOpenCleaner && <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sammlung aufräumen"
          accessibilityState={{ disabled: cleanerDisabled }}
          disabled={cleanerDisabled}
          onPress={onOpenCleaner}
          style={[styles.iconButton, { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border, opacity: cleanerDisabled ? 0.5 : 1 }]}
          testID="library-open-cleaner"
        >
          <Sparkles color={theme.palette.text.primary} size={22} />
        </Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Suche schließen und Filter löschen' : 'Suche öffnen'}
          onPress={onToggleSearch}
          hitSlop={8}
          style={[styles.iconButton, { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border }]}
          testID="library-toggle-search"
        >
          {searchOpen ? <X color={theme.palette.text.primary} size={22} />
            : <Search color={theme.palette.text.primary} size={22} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mehr Optionen"
          onPress={onOpenMenu}
          hitSlop={8}
          style={[styles.iconButton, { backgroundColor: theme.palette.surfaceGlass, borderColor: theme.palette.border }]}
          testID="library-open-menu"
        >
          <MoreVertical color={theme.palette.text.primary} size={22} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { flex: 1, minWidth: 0 },
  brandLogo: { width: 38, height: 38, flexShrink: 0, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth },
  brandCaption: { fontSize: 8, letterSpacing: 2.1, fontFamily: staticTokens.fonts.body },
  brand: { fontFamily: staticTokens.fonts.heading, fontSize: 25, letterSpacing: -0.8 },
  topActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 48, height: 48, flexShrink: 0, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});

export default LibraryTopBar;
