import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

interface TrackInfoRowProps {
  label: string;
  value: string;
  long?: boolean;
}

const TrackInfoRow: React.FC<TrackInfoRowProps> = ({ label, value, long = false }) => (
  <Text style={long ? styles.longRow : styles.row}>{label}: {value}</Text>
);

const styles = StyleSheet.create({
  row: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
  longRow: { color: theme.palette.text.secondary, fontFamily: theme.fonts.body, fontSize: 13 },
});

export default TrackInfoRow;
