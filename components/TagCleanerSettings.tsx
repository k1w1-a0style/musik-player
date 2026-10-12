import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

const TagCleanerSettings = ({ onOpen }: { onOpen?: () => void }) => {
  const { theme } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: theme.palette.surface, borderColor: theme.palette.border }]}>
    <Text style={[styles.title, { color: theme.palette.text.primary }]}>Musiksammlung aufräumen</Text>
    <Text style={{ color: theme.palette.text.secondary }}>Titel, Alben, Ordner oder Playlists prüfen. Du siehst alle Vorschläge vor dem Anwenden.</Text>
    <Pressable testID="settings-tag-cleaner" accessibilityRole="button" accessibilityLabel="Tags bereinigen"
      accessibilityState={{ disabled: !onOpen }} disabled={!onOpen} onPress={onOpen} style={styles.action}>
      <Text style={{ color: theme.palette.primary }}>Tags bereinigen</Text>
    </Pressable>
  </View>;
};
const styles = StyleSheet.create({ card: { padding: 16, gap: 10, borderWidth: 1, borderRadius: 16 },
  title: { fontSize: 18 }, action: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 } });
export default TagCleanerSettings;
