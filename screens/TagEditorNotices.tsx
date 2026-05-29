import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface TagEditorNoticesProps {
  capabilityMessage?: string;
  blockedReasonMessage?: string;
  safetyMessage?: string;
}

const TagEditorNotices: React.FC<TagEditorNoticesProps> = ({
  capabilityMessage,
  blockedReasonMessage,
  safetyMessage,
}) => (
  <>
    {!!capabilityMessage && (
      <View style={styles.warningBox}>
        <Text style={styles.warning}>{capabilityMessage}</Text>
      </View>
    )}
    {!!blockedReasonMessage && (
      <View style={styles.warningBox}>
        <Text style={styles.warning}>{blockedReasonMessage}</Text>
      </View>
    )}
    {!!safetyMessage && (
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>{safetyMessage}</Text>
      </View>
    )}
  </>
);

const styles = StyleSheet.create({
  warningBox: {
    backgroundColor: 'rgba(255, 111, 138, 0.12)',
    borderColor: 'rgba(255, 111, 138, 0.4)',
    borderWidth: 1,
    borderRadius: theme.radii.input,
    padding: 10,
  },
  warning: { color: theme.palette.error, fontFamily: theme.fonts.body },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: theme.palette.border,
    borderWidth: 1,
    borderRadius: theme.radii.input,
    padding: 10,
  },
  infoText: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body },
});

export default TagEditorNotices;
