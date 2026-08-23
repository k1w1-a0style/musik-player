import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { APP_THEME_TOKENS as staticTokens } from '../utils/appTheme';
import { useAppTheme } from '../contexts/AppThemeContext';

export interface LibrarySearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}

const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({ value, onChangeText, autoFocus }) => {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.searchWrap,
        {
          backgroundColor: theme.palette.surfaceGlass,
          borderColor: theme.palette.border,
        },
      ]}
      testID="library-search-bar"
    >
      <Search color={theme.palette.text.muted} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Bibliothek durchsuchen"
        placeholder="Titel, Künstler, Album, Genre suchen"
        placeholderTextColor={theme.palette.text.muted}
        style={[styles.searchInput, { color: theme.palette.text.primary }]}
        autoFocus={autoFocus}
        testID="library-search-input"
      />
      {value ? <Pressable accessibilityRole="button" accessibilityLabel="Suchtext löschen"
        onPress={() => onChangeText('')} hitSlop={8} style={styles.clearButton} testID="library-search-clear">
        <X color={theme.palette.text.secondary} size={18} />
      </Pressable> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: staticTokens.fonts.body,
    paddingVertical: 8,
    fontSize: 13,
  },
  clearButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

export default LibrarySearchBar;
