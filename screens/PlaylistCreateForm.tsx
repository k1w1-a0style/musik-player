import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { theme } from '../theme';

interface PlaylistCreateFormProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
}

const PlaylistCreateForm: React.FC<PlaylistCreateFormProps> = ({
  value,
  onChangeText,
  onSubmit,
}) => (
  <View style={styles.inputContainer}>
    <TextInput
      testID="new-playlist-input"
      style={styles.input}
      placeholder="Neue Playlist erstellen…"
      placeholderTextColor={theme.palette.text.muted}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      returnKeyType="done"
      accessibilityLabel="Name der neuen Playlist"
    />
    <Pressable
      testID="create-playlist-button"
      accessibilityRole="button"
      accessibilityLabel="Playlist erstellen"
      onPress={onSubmit}
      style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
    >
      <Plus color={theme.palette.text.onPrimary} size={18} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.palette.surface,
    color: theme.palette.text.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.palette.border,
    fontFamily: theme.fonts.body,
  },
  addButton: {
    backgroundColor: theme.palette.primary,
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

export default PlaylistCreateForm;
