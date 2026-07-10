import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';
import type { EditableTrackTags } from '../types/TagEdit';
import { FIELDS, type FormState } from './tagEditorHelpers';

interface TagEditorFieldsProps {
  form: FormState;
  editable: boolean;
  onChangeField: (key: keyof EditableTrackTags, value: string) => void;
}

const TagEditorFields: React.FC<TagEditorFieldsProps> = ({
  form,
  editable,
  onChangeField,
}) => {
  const { theme } = useAppTheme();

  return (
    <>
      {FIELDS.map(field => (
        <View key={field.key} style={styles.fieldWrap}>
          <Text style={[styles.label, { color: theme.palette.text.secondary }]}>{field.label}</Text>
          <TextInput
            testID={`input-${field.key}`}
            accessibilityLabel={field.label}
            accessibilityState={{ disabled: !editable }}
            placeholder="Nicht verfügbar"
            placeholderTextColor={theme.palette.text.muted}
            value={form[field.key]}
            editable={editable}
            onChangeText={value => onChangeField(field.key, value)}
            style={[
              styles.input,
              {
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.border,
                color: theme.palette.text.primary,
              },
              !editable && styles.inputReadOnly,
            ]}
          />
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  fieldWrap: { gap: 4 },
  label: { fontFamily: APP_THEME_TOKENS.fonts.body },
  input: {
    borderWidth: 1,
    borderRadius: APP_THEME_TOKENS.radii.input,
    padding: 10,
    fontFamily: APP_THEME_TOKENS.fonts.body,
  },
  inputReadOnly: { opacity: 0.8 },
});

export default TagEditorFields;
