import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

const AppLoading: React.FC = () => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.loading, { backgroundColor: theme.palette.background }]} testID="app-loading">
      <ActivityIndicator size="large" color={theme.palette.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppLoading;
