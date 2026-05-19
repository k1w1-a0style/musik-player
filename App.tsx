import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types/navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from '@expo-google-fonts/bricolage-grotesque';

import AppErrorBoundary from './components/AppErrorBoundary';
import AppLoading from './components/AppLoading';
import { MusicProvider } from './contexts/MusicContext';
import { PlaybackProgressProvider } from './contexts/PlaybackProgressContext';
import NowPlaying from './screens/NowPlaying';
import TrackInfo from './screens/TrackInfo';
import TagEditor from './screens/TagEditor';
import { appFonts } from './appFonts';
import { appNavigationTheme } from './navigation/appNavigationTheme';
import TabsShell from './navigation/TabsShell';
import { theme } from './theme';
import { APP_STACK_ROUTES } from './types/routes';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function App(): React.ReactElement {
  const [fontsLoaded] = useFonts(appFonts);

  if (!fontsLoaded) return <AppLoading />;

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <MusicProvider>
          <PlaybackProgressProvider>
            <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
            <NavigationContainer theme={appNavigationTheme}>
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
