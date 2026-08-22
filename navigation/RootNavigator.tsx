/* eslint-disable @typescript-eslint/no-require-imports -- React Navigation getComponent intentionally defers non-initial screen evaluation. */
import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { APP_STACK_ROUTES } from '../types/routes';
import { createAppNavigationTheme } from './appNavigationTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import MainShell from './MainShell';

const Stack = createNativeStackNavigator<AppStackParamList>();

const getTrackInfoScreen = (): typeof import('../screens/TrackInfo').default =>
  require('../screens/TrackInfo').default;
const getTagEditorScreen = (): typeof import('../screens/TagEditor').default =>
  require('../screens/TagEditor').default;
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

  return (
    <NavigationContainer theme={navigationTheme}>
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
