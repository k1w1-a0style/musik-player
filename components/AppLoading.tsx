import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

const AppLoading: React.FC = () => (
  <View style={styles.loading} testID="app-loading">
    <ActivityIndicator size="large" color={theme.palette.primary} />
  </View>
);

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background,
  },
});

export default AppLoading;
