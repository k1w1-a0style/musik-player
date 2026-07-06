import React from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';

interface TagEditorActionsProps {
  canSave: boolean;
  saving: boolean;
  status: string | null;
  onConfirmSave: () => void;
  onBack: () => void;
}

const TagEditorActions: React.FC<TagEditorActionsProps> = ({
  canSave,
  saving,
  status,
  onConfirmSave,
  onBack,
}) => {
  const { theme } = useAppTheme();

  return (
    <>
      <Pressable
        testID="save-button"
        accessibilityRole="button"
        accessibilityLabel={saving ? 'Speichern läuft' : 'Metadaten speichern'}
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.saveButton,
          {
            backgroundColor: theme.palette.surfaceElevated,
            borderColor: theme.palette.borderStrong,
          },
          !canSave && styles.disabledButton,
        ]}
        disabled={!canSave}
        onPress={() =>
          Alert.alert('Bestätigung', 'Metadaten wirklich in Datei schreiben?', [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Speichern',
              onPress: onConfirmSave,
            },
          ])
        }
      >
        <Text style={[styles.saveText, { color: theme.palette.text.primary }]}>
          {saving ? 'Speichern…' : 'Speichern'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.backButton,
          {
            backgroundColor: theme.palette.surfaceGlass,
            borderColor: theme.palette.border,
          },
        ]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Zurück"
      >
        <Text style={[styles.backText, { color: theme.palette.text.secondary }]}>Zurück</Text>
      </Pressable>
      {status && <Text style={[styles.status, { color: theme.palette.text.secondary }]}>{status}</Text>}
    </>
  );
};

const styles = StyleSheet.create({
  saveButton: {
    padding: 12,
    borderRadius: staticTheme.radii.input,
    borderWidth: 1,
  },
  backButton: {
    padding: 12,
    borderRadius: staticTheme.radii.input,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disabledButton: { opacity: 0.48 },
  saveText: {
    textAlign: 'center',
    fontFamily: staticTheme.fonts.heading,
  },
  backText: {
    textAlign: 'center',
    fontFamily: staticTheme.fonts.heading,
  },
  status: { fontFamily: staticTheme.fonts.body },
});

export default TagEditorActions;
