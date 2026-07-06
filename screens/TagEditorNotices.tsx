import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { theme as staticTheme } from '../theme';

interface TagEditorNoticesProps {
  capabilityMessage?: string;
  blockedReasonMessage?: string;
  safetyMessage?: string;
}

const TagEditorNotices: React.FC<TagEditorNoticesProps> = ({
  capabilityMessage,
  blockedReasonMessage,
  safetyMessage,
}) => {
  const { theme } = useAppTheme();
  const warningBoxStyle = [
    styles.warningBox,
    {
      backgroundColor: theme.appearance === 'light' ? 'rgba(200, 58, 89, 0.10)' : 'rgba(255, 111, 138, 0.12)',
      borderColor: theme.appearance === 'light' ? 'rgba(200, 58, 89, 0.34)' : 'rgba(255, 111, 138, 0.40)',
    },
  ];
  const infoBoxStyle = [
    styles.infoBox,
    {
      backgroundColor: theme.palette.surfaceGlass,
      borderColor: theme.palette.border,
    },
  ];

  return (
    <>
      {!!capabilityMessage && (
        <View style={warningBoxStyle}>
          <Text style={[styles.warning, { color: theme.palette.error }]}>{capabilityMessage}</Text>
        </View>
      )}
      {!!blockedReasonMessage && (
        <View style={warningBoxStyle}>
          <Text style={[styles.warning, { color: theme.palette.error }]}>{blockedReasonMessage}</Text>
        </View>
      )}
      {!!safetyMessage && (
        <View style={infoBoxStyle}>
          <Text style={[styles.infoText, { color: theme.palette.text.secondary }]}>{safetyMessage}</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  warningBox: {
    borderWidth: 1,
    borderRadius: staticTheme.radii.input,
    padding: 10,
  },
  warning: { fontFamily: staticTheme.fonts.body },
  infoBox: {
    borderWidth: 1,
    borderRadius: staticTheme.radii.input,
    padding: 10,
  },
  infoText: { fontFamily: staticTheme.fonts.body },
});

export default TagEditorNotices;
