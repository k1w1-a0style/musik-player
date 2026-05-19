import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { useFonts } from '@expo-google-fonts/bricolage-grotesque';

import AppLoading from './components/AppLoading';
import AppProviders from './components/AppProviders';
import { appFonts } from './appFonts';
import RootNavigator from './navigation/RootNavigator';
import { theme } from './theme';

export default function App(): React.ReactElement {
  const [fontsLoaded] = useFonts(appFonts);

  if (!fontsLoaded) return <AppLoading />;

  return (
    <AppProviders>
      <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
      <RootNavigator />
    </AppProviders>
  );
}
