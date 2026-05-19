import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types/navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';

import AppErrorBoundary from './components/AppErrorBoundary';
import { MusicProvider } from './contexts/MusicContext';
import { PlaybackProgressProvider } from './contexts/PlaybackProgressContext';
import NowPlaying from './screens/NowPlaying';
import TrackInfo from './screens/TrackInfo';
import TagEditor from './screens/TagEditor';
import TabsShell from './navigation/TabsShell';
import { theme } from './theme';
import { APP_STACK_ROUTES } from './types/routes';

const Stack = createNativeStackNavigator<AppStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.palette.primary,
    background: theme.palette.background,
    card: theme.palette.surface,
    text: theme.palette.text.primary,
    border: theme.palette.border,
    notification: theme.palette.accent,
  },
};

export default function App(): React.ReactElement {
  const [fontsLoaded] = useFonts({
    'Bricolage-Regular': BricolageGrotesque_400Regular,
    'Bricolage-Medium': BricolageGrotesque_500Medium,
    'Bricolage-SemiBold': BricolageGrotesque_600SemiBold,
    'Bricolage-Bold': BricolageGrotesque_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading} testID="app-loading">
        <ActivityIndicator size="large" color={theme.palette.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <MusicProvider>
          <PlaybackProgressProvider>
            <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
            <NavigationContainer theme={navTheme}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name={APP_STACK_ROUTES.MAIN_TABS}>
                  {({ navigation }) => <TabsShell openNowPlaying={() => navigation.navigate(APP_STACK_ROUTES.NOW_PLAYING)} />}
                </Stack.Screen>
                <Stack.Screen name={APP_STACK_ROUTES.TRACK_INFO} component={TrackInfo} options={{ headerShown: true, title: 'TrackInfo' }} />
                <Stack.Screen name={APP_STACK_ROUTES.TAG_EDITOR} component={TagEditor} options={{ headerShown: true, title: 'Tag Editor' }} />
                <Stack.Screen
                  name={APP_STACK_ROUTES.NOW_PLAYING}
                  component={NowPlaying}
                  options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </PlaybackProgressProvider>
        </MusicProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background,
  },
});