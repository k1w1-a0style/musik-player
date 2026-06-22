import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import NowPlaying from '../screens/NowPlaying';
import TrackInfo from '../screens/TrackInfo';
import TagEditor from '../screens/TagEditor';
import Equalizer from '../screens/Equalizer';
import { APP_STACK_ROUTES } from '../types/routes';
import { appNavigationTheme } from './appNavigationTheme';
import MainShell from './MainShell';

const Stack = createNativeStackNavigator<AppStackParamList>();

const RootNavigator: React.FC = () => (
  <NavigationContainer theme={appNavigationTheme}>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        name={APP_STACK_ROUTES.NOW_PLAYING}
        component={NowPlaying}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

export default RootNavigator;
