import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { theme } from '../theme';

export interface LibrarySearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}

const LibrarySearchBar: React.FC<LibrarySearchBarProps> = ({ value, onChangeText, autoFocus }) => (
  <View style={styles.searchWrap} testID="library-search-bar">
    <Search color={theme.palette.text.muted} size={18} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel="Bibliothek durchsuchen"
      placeholder="Titel, Künstler, Album, Genre suchen"
      placeholderTextColor={theme.palette.text.muted}
      style={styles.searchInput}
      autoFocus={autoFocus}
      testID="library-search-input"
    />
  </View>
);

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, paddingHorizontal: 12, marginHorizontal: 20, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, color: theme.palette.text.primary, fontFamily: theme.fonts.body, paddingVertical: 8, fontSize: 13 },
});

export default LibrarySearchBar;
