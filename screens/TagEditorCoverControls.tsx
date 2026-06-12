import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { theme } from '../theme';

interface TagEditorCoverControlsProps {
  canWrite: boolean;
  saving: boolean;
  hasCover: boolean;
  removeCover: boolean;
  replacementCover: PickedTagCover | null;
  onToggleRemoveCover: () => void;
  onPickCover: () => void;
}

const TagEditorCoverControls: React.FC<TagEditorCoverControlsProps> = ({
  canWrite,
  saving,
  hasCover,
  removeCover,
  replacementCover,
  onToggleRemoveCover,
  onPickCover,
}) => {
  const hasReplacementCover = Boolean(replacementCover);
  const removeDisabled = !canWrite || !hasCover || saving || hasReplacementCover;
  const pickDisabled = !canWrite || saving;

  return (
    <>
      <Pressable
        testID="remove-cover"
        accessibilityRole="switch"
        accessibilityLabel="Cover entfernen"
        accessibilityState={{ checked: removeCover, disabled: removeDisabled }}
        style={[styles.toggle, hasReplacementCover && styles.disabledButton]}
        disabled={removeDisabled}
        onPress={onToggleRemoveCover}
      >
        <Text style={styles.toggleText}>Cover entfernen: {removeCover ? 'Ja' : 'Nein'}</Text>
      </Pressable>

      <Pressable
        testID="pick-cover"
        accessibilityRole="button"
        accessibilityLabel={
          hasReplacementCover
            ? 'Cover ausgewählt — tippen zum Ändern'
            : 'Cover auswählen (JPG/PNG, max. 5 MB)'
        }
        accessibilityState={{ disabled: pickDisabled }}
        disabled={pickDisabled}
        style={({ pressed }) => [
          styles.toggle,
          pressed && styles.pressed,
          pickDisabled && styles.disabledButton,
        ]}
        onPress={onPickCover}
      >
        <Text style={styles.toggleText}>
          Cover auswählen: {hasReplacementCover ? 'Ausgewählt' : 'JPG/PNG'}
        </Text>
        <Text style={styles.helperText}>
          Maximal 5 MB. Ein neues Cover ersetzt ein bestehendes Cover beim Speichern.
        </Text>
      </Pressable>

      {replacementCover?.uri && (
        <View testID="cover-preview" style={styles.coverPreviewWrap}>
          <Image source={{ uri: replacementCover.uri }} style={styles.coverPreview} />
          <Text style={styles.helperText}>
            {replacementCover.mimeType} · {Math.round(replacementCover.sizeBytes / 1024)} KB
          </Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  toggle: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  toggleText: { color: theme.palette.text.primary },
  helperText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 6 },
  coverPreviewWrap: {
    padding: 12,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.surface,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
    gap: 8,
  },
  coverPreview: { width: 130, height: 130, borderRadius: 18 },
  disabledButton: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});

export default TagEditorCoverControls;
