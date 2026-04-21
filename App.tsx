import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MusicProvider } from './contexts/MusicContext';
import Library from './screens/Library';
import NowPlaying from './screens/NowPlaying';
import Playlists from './screens/Playlists';
import Equalizer from './screens/Equalizer';
import Id3TagEditor from './screens/Id3TagEditor';
import Covers from './screens/Covers';
import { theme } from './theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.palette.primary,
    background: theme.palette.background,
    card: theme.palette.card,
    text: theme.palette.text.primary,
    border: theme.palette.border,
    notification: theme.palette.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <MusicProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: theme.palette.card },
              headerTitleStyle: { color: theme.palette.text.primary },
              tabBarStyle: {
                backgroundColor: theme.palette.card,
                borderTopColor: theme.palette.border,
              },
              tabBarActiveTintColor: theme.palette.primary,
              tabBarInactiveTintColor: theme.palette.text.secondary,
            }}
          >
            <Tab.Screen name="Bibliothek" component={Library} />
            <Tab.Screen name="Wiedergabe" component={NowPlaying} />
            <Tab.Screen name="Playlists" component={Playlists} />
            <Tab.Screen name="Equalizer" component={Equalizer} />
            <Tab.Screen name="Tags" component={Id3TagEditor} />
            <Tab.Screen name="Cover" component={Covers} />
          </Tab.Navigator>
        </NavigationContainer>
      </MusicProvider>
    </SafeAreaProvider>
  );
}
