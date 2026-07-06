import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';

interface TrackInfoActionsProps {
  onOpenTagEditor: () => void;
  onRemoveFromLibrary: () => void;
}

const TrackInfoActions: React.FC<TrackInfoActionsProps> = ({
  onOpenTagEditor,
  onRemoveFromLibrary,
}) => {
  const { theme } = useAppTheme();
  const dangerColor = theme.palette.error;

  return (
    <>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tags bearbeiten"
          style={[
            styles.editButton,
            {
              backgroundColor: theme.palette.surfaceElevated,
              borderColor: theme.palette.borderStrong,
            },
          ]}
          onPress={onOpenTagEditor}
        >
          <Text style={[styles.editButtonText, { color: theme.palette.text.primary }]}>
            ID3/M4A Tags bearbeiten
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Titel aus Bibliothek entfernen"
          style={[styles.removeButton, { borderColor: dangerColor }]}
          onPress={onRemoveFromLibrary}
        >
          <Text style={[styles.removeButtonText, { color: dangerColor }]}>Aus Bibliothek entfernen</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: theme.palette.text.muted }]}>
        Hinweis: Entfernen löscht nicht die Datei vom Gerät.
      </Text>
    </>
  );
};

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  editButton: {
    borderRadius: staticTheme.radii.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  editButtonText: { fontFamily: staticTheme.fonts.heading, fontSize: 13 },
  removeButton: {
    borderRadius: staticTheme.radii.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  removeButtonText: { fontFamily: staticTheme.fonts.heading, fontSize: 13 },
  hint: { fontFamily: staticTheme.fonts.body, fontSize: 12, marginBottom: 4 },
});

export default TrackInfoActions;
