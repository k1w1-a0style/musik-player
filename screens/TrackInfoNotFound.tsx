import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { theme } from '../theme';

const TrackInfoNotFound: React.FC = () => (
  <AppBackground>
    <Screen contentStyle={styles.container}>
      <Text style={styles.error}>Titel nicht gefunden.</Text>
    </Screen>
  </AppBackground>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  error: { color: theme.palette.text.primary, fontFamily: theme.fonts.heading, fontSize: 16 },
});

export default TrackInfoNotFound;
