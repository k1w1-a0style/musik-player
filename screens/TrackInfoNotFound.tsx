import React from 'react';
import { StyleSheet, Text } from 'react-native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';

const TrackInfoNotFound: React.FC = () => {
  const { theme } = useAppTheme();

  return (
    <AppBackground>
      <Screen contentStyle={styles.container}>
        <Text
          style={[
            styles.error,
            {
              color: theme.palette.text.primary,
              fontFamily: theme.tokens.fonts.heading,
            },
          ]}
          testID="track-info-not-found-message"
        >
          Titel nicht gefunden.
        </Text>
      </Screen>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  error: { fontSize: 16 },
});

export default TrackInfoNotFound;
