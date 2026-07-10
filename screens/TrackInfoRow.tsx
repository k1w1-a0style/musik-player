import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { APP_THEME_TOKENS } from '../utils/appTheme';

interface TrackInfoRowProps {
  label: string;
  value: string;
  long?: boolean;
}

const TrackInfoRow: React.FC<TrackInfoRowProps> = ({ label, value, long = false }) => {
  const { theme } = useAppTheme();

  return (
    <Text style={[long ? styles.longRow : styles.row, { color: theme.palette.text.secondary }]}>
      {label}: {value}
    </Text>
  );
};

const styles = StyleSheet.create({
  row: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 13 },
  longRow: { fontFamily: APP_THEME_TOKENS.fonts.body, fontSize: 13 },
});

export default TrackInfoRow;
