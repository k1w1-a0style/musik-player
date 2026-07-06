import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getTagEditorWarningBoxColors } from '../utils/appThemeOverlays';
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
