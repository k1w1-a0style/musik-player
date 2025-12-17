import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

const Equalizer: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equalizer</Text>
      <Text style={styles.placeholderText}>Equalizer Funktionalität wird hier implementiert.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
});

export default Equalizer;
