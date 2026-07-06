import React from 'react';
import { StatusBar } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

const ThemedStatusBar: React.FC = () => {
  const { theme } = useAppTheme();

  return <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.palette.background} />;
};

export default ThemedStatusBar;
