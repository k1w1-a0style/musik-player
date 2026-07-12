import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';

interface PlaylistCreateFormProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  cardTestID?: string;
  inputTestID?: string;
  buttonTestID?: string;
  helperText?: string;
}

const PlaylistCreateForm: React.FC<PlaylistCreateFormProps> = ({
  value,
  onChangeText,
  onSubmit,
  cardTestID = 'playlist-create-card',
  inputTestID = 'new-playlist-input',
  buttonTestID = 'create-playlist-button',
  helperText = 'Erstelle eine leere Playlist, ohne vorher einen Track auszuwählen.',
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.palette.surfaceElevated, borderColor: theme.palette.border }]} testID={cardTestID}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.palette.text.primary }]}>Neue Playlist erstellen</Text>
          <Text style={[styles.subtitle, { color: theme.palette.text.secondary }]}>{helperText}</Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          testID={inputTestID}
          style={[
            styles.input,
            {
              backgroundColor: theme.palette.surface,
              borderColor: theme.palette.border,
              color: theme.palette.text.primary,
            },
          ]}
          placeholder="Playlist-Name"
          placeholderTextColor={theme.palette.text.muted}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          returnKeyType="done"
          accessibilityLabel="Name der neuen Playlist"
        />
        <Pressable
          testID={buttonTestID}
          accessibilityRole="button"
          accessibilityLabel="Neue Playlist erstellen"
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.palette.primary },
            pressed && styles.pressed,
          ]}
        >
          <Plus color={theme.palette.text.onPrimary} size={17} />
          <Text style={[styles.addButtonText, { color: theme.palette.text.onPrimary }]}>Erstellen</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: APP_THEME_TOKENS.radii.card,
    borderWidth: 1,
    marginBottom: APP_THEME_TOKENS.spacing.lg,
    padding: APP_THEME_TOKENS.spacing.md,
    gap: APP_THEME_TOKENS.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_THEME_TOKENS.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 17,
  },
  subtitle: {
    fontFamily: APP_THEME_TOKENS.fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
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
    minHeight: 44,
    borderRadius: APP_THEME_TOKENS.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: APP_THEME_TOKENS.spacing.md,
  },
  addButtonText: {
    fontFamily: APP_THEME_TOKENS.fonts.heading,
    fontSize: 13,
  },
  pressed: { opacity: 0.7 },
});

export default PlaylistCreateForm;
