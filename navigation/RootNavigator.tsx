import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import NowPlaying from '../screens/NowPlaying';
import TrackInfo from '../screens/TrackInfo';
import TagEditor from '../screens/TagEditor';
import Equalizer from '../screens/Equalizer';
import Settings from '../screens/Settings';
import PlaylistDetail from '../screens/PlaylistDetail';
import { APP_STACK_ROUTES } from '../types/routes';
import { createAppNavigationTheme } from './appNavigationTheme';
import { useAppTheme } from '../contexts/AppThemeContext';
import MainShell from './MainShell';

const Stack = createNativeStackNavigator<AppStackParamList>();

const RootNavigator: React.FC = () => {
  const { theme } = useAppTheme();
  const navigationTheme = useMemo(() => createAppNavigationTheme(theme), [theme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.palette.surface },
          headerTintColor: theme.palette.text.primary,
          headerTitleStyle: { color: theme.palette.text.primary },
        }}
      >
      <Stack.Screen name={APP_STACK_ROUTES.MAIN_TABS}>
        {({ navigation }) => (
          <MainShell openNowPlaying={() => navigation.navigate(APP_STACK_ROUTES.NOW_PLAYING)} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name={APP_STACK_ROUTES.TRACK_INFO}
        component={TrackInfo}
        options={{ headerShown: true, title: 'Track-Info' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.TAG_EDITOR}
        component={TagEditor}
        options={{ headerShown: true, title: 'Tags bearbeiten' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.EQUALIZER}
        component={Equalizer}
        options={{ headerShown: true, title: 'Equalizer' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.SETTINGS}
        component={Settings}
        options={{ headerShown: true, title: 'Einstellungen' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.PLAYLIST_DETAIL}
        component={PlaylistDetail}
        options={{ headerShown: true, title: 'Playlist' }}
      />
      <Stack.Screen
        name={APP_STACK_ROUTES.NOW_PLAYING}
        component={NowPlaying}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
