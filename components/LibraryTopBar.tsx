import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreVertical, Search, X } from 'lucide-react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

export interface LibraryTopBarProps {
  title?: string;
  searchOpen?: boolean;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
}

const LibraryTopBar: React.FC<LibraryTopBarProps> = ({
  title = 'K1W1 Music',
  searchOpen = false,
  onToggleSearch,
  onOpenMenu,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.topBar} testID="library-top-bar">
      <Text style={[styles.brand, { color: theme.palette.text.primary }]}>{title}</Text>
      <View style={styles.topActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? 'Suche schließen und Filter löschen' : 'Suche öffnen'}
          onPress={onToggleSearch}
          hitSlop={8}
          style={styles.iconButton}
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
          style={styles.iconButton}
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
  brand: { fontFamily: staticTokens.fonts.heading, fontSize: 25, letterSpacing: -0.8 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

export default LibraryTopBar;
