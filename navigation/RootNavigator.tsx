/* eslint-disable @typescript-eslint/no-require-imports -- React Navigation getComponent intentionally defers non-initial screen evaluation. */
import React, { useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import { createAppNavigationTheme } from './appNavigationTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import MainShell from './MainShell';
import { setPlaybackProgressVisible } from '../utils/playbackProgressVisibility';

const Stack = createNativeStackNavigator<AppStackParamList>();

const getTrackInfoScreen = (): typeof import('../screens/TrackInfo').default =>
  require('../screens/TrackInfo').default;
const getTagEditorScreen = (): typeof import('../screens/TagEditor').default =>
  require('../screens/TagEditor').default;
const getTagCleanerScreen = (): typeof import('../screens/TagCleaner').default =>
  require('../screens/TagCleaner').default;
const getEqualizerScreen = (): typeof import('../screens/Equalizer').default =>
  require('../screens/Equalizer').default;
const getSettingsScreen = (): typeof import('../screens/Settings').default =>
  require('../screens/Settings').default;
const getPlaylistDetailScreen = (): typeof import('../screens/PlaylistDetail').default =>
  require('../screens/PlaylistDetail').default;
const getNowPlayingScreen = (): typeof import('../screens/NowPlaying').default =>
  require('../screens/NowPlaying').default;

const RootNavigator: React.FC = () => {
  const { theme } = useAppTheme();
  const navigationTheme = useMemo(() => createAppNavigationTheme(theme), [theme]);
  useEffect(() => { setPlaybackProgressVisible(true); return () => setPlaybackProgressVisible(false); }, []);

  return (
    <NavigationContainer theme={navigationTheme} onStateChange={state => {
      const route = state?.routes[state.index]?.name;
      setPlaybackProgressVisible(route === undefined || route === APP_STACK_ROUTES.MAIN_TABS || route === APP_STACK_ROUTES.NOW_PLAYING);
    }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.palette.background },
          headerTintColor: theme.palette.text.primary,
          headerTitleStyle: { color: theme.palette.text.primary },
          headerShadowVisible: false,
        }}
      >
      <Stack.Screen name={APP_STACK_ROUTES.MAIN_TABS}>
        {({ navigation }) => (
          <MainShell openNowPlaying={() => navigation.navigate(APP_STACK_ROUTES.NOW_PLAYING)} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name={APP_STACK_ROUTES.TRACK_INFO}
        getComponent={getTrackInfoScreen}
        options={{ headerShown: true, title: 'Track-Info' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.TAG_EDITOR}
        getComponent={getTagEditorScreen}
        options={{ headerShown: true, title: 'Tags bearbeiten' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.EQUALIZER}
        getComponent={getEqualizerScreen}
        options={{ headerShown: true, title: 'Equalizer' }}
      />
      <Stack.Screen name={APP_STACK_ROUTES.TAG_CLEANER} getComponent={getTagCleanerScreen}
        options={{ headerShown: true, title: 'Tags bereinigen' }} />
      <Stack.Screen
        name={APP_STACK_ROUTES.SETTINGS}
        getComponent={getSettingsScreen}
        options={{ headerShown: true, title: 'Einstellungen' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.PLAYLIST_DETAIL}
        getComponent={getPlaylistDetailScreen}
        options={{ headerShown: true, title: 'Playlist' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.NOW_PLAYING}
        getComponent={getNowPlayingScreen}
        options={{ presentation: 'transparentModal', animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: 'transparent' } }}
      />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
