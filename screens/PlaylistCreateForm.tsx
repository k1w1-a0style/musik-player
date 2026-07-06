import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';

interface PlaylistCreateFormProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
}

const PlaylistCreateForm: React.FC<PlaylistCreateFormProps> = ({
  value,
  onChangeText,
  onSubmit,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.inputContainer}>
      <TextInput
        testID="new-playlist-input"
        style={[
          styles.input,
          {
            backgroundColor: theme.palette.surface,
            borderColor: theme.palette.border,
            color: theme.palette.text.primary,
          },
        ]}
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
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: theme.palette.primary },
          pressed && styles.pressed,
        ]}
      >
        <Plus color={theme.palette.text.onPrimary} size={18} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    marginBottom: staticTheme.spacing.lg,
    alignItems: 'center',
    gap: staticTheme.spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: staticTheme.spacing.md,
    paddingVertical: 12,
    borderRadius: staticTheme.borderRadius.md,
    borderWidth: 1,
    fontFamily: staticTheme.fonts.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: staticTheme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

export default PlaylistCreateForm;
