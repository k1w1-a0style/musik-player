import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getTagEditorWarningBoxColors } from '../utils/appThemeOverlays';
import { APP_THEME_TOKENS } from '../utils/appTheme';

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
  const warningBoxColors = getTagEditorWarningBoxColors(theme.appearance);
  const warningBoxStyle = [styles.warningBox, warningBoxColors];
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
    borderRadius: APP_THEME_TOKENS.radii.input,
    padding: 10,
  },
  warning: { fontFamily: APP_THEME_TOKENS.fonts.body },
  infoBox: {
    borderWidth: 1,
    borderRadius: APP_THEME_TOKENS.radii.input,
    padding: 10,
  },
  infoText: { fontFamily: APP_THEME_TOKENS.fonts.body },
});

export default TagEditorNotices;
