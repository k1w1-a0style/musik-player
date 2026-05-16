import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreVertical, Search } from 'lucide-react-native';
import { theme } from '../theme';

interface LibraryTopBarProps {
  title?: string;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
}

const LibraryTopBar: React.FC<LibraryTopBarProps> = ({
  title = 'K1W1 Music',
  onToggleSearch,
  onOpenMenu,
}) => (
  <View style={styles.topBar} testID="library-top-bar">
    <Text style={styles.brand}>{title}</Text>
    <View style={styles.topActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Suche öffnen"
        onPress={onToggleSearch}
        style={styles.iconButton}
        testID="library-toggle-search"
      >
        <Search color={theme.palette.text.primary} size={22} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mehr Optionen"
        onPress={onOpenMenu}
        style={styles.iconButton}
        testID="library-open-menu"
      >
        <MoreVertical color={theme.palette.text.primary} size={22} />
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  brand: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 25, letterSpacing: -0.8 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

export default LibraryTopBar;
