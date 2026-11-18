import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MoreVertical, Search, X } from 'lucide-react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { KIWI_MUSIC_ARTWORK } from '../utils/songArtwork';
import { useAppTheme } from '../contexts/AppThemeContext';

export interface LibraryTopBarProps {
  activity?: React.ReactNode;
  title?: string;
  searchOpen?: boolean;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
}

const LibraryTopBar: React.FC<LibraryTopBarProps> = ({
  activity,
  title = 'K1W1 Music',
  searchOpen = false,
  onToggleSearch,
  onOpenMenu,
}) => {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.topBar} testID="library-top-bar">
      <View style={styles.brandRow}>
        <View pointerEvents="none"><Image source={KIWI_MUSIC_ARTWORK} style={[styles.brandLogo, { borderColor: theme.palette.borderStrong }]}
          fadeDuration={0} accessible={false} /></View>
        <View style={styles.brandText} testID="library-brand-title">
          <Text numberOfLines={2} style={[styles.brand, width < 360 && styles.compactBrand,
            { color: theme.palette.text.primary }]}>{title}</Text>
          {activity}
        </View>
      </View>
      <View style={styles.topActions}>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 6 },
  brandRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandLogo: { width: 28, height: 28, flexShrink: 0, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  brand: { flexShrink: 1, fontFamily: staticTokens.fonts.heading, fontSize: 21, letterSpacing: -0.5 },
  compactBrand: { fontSize: 18 },
  topActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: 48, height: 48, flexShrink: 0, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});

export default LibraryTopBar;
