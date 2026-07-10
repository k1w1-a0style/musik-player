import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';

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
    marginBottom: APP_THEME_TOKENS.spacing.lg,
    alignItems: 'center',
    gap: APP_THEME_TOKENS.spacing.sm,
  },
  input: {
    flex: 1,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
    paddingVertical: 12,
    borderRadius: APP_THEME_TOKENS.borderRadius.md,
    borderWidth: 1,
    fontFamily: APP_THEME_TOKENS.fonts.body,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

export default PlaylistCreateForm;
