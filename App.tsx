import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Library as LibraryIcon,
  Disc3,
  ListMusic,
  Sliders,
  Tag,
  Image as ImageIcon,
} from 'lucide-react-native';

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
      <MusicProvider>
        <StatusBar barStyle="light-content" backgroundColor={theme.palette.background} />
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.palette.background,
                shadowColor: 'transparent',
                elevation: 0,
                borderBottomWidth: 0,
              },
              headerTitleStyle: {
                color: theme.palette.text.primary,
                fontFamily: theme.fonts.heading,
                fontSize: 18,
                letterSpacing: -0.3,
              },
              tabBarStyle: {
                backgroundColor: theme.palette.surface,
                borderTopColor: theme.palette.border,
                height: 64,
                paddingBottom: 8,
                paddingTop: 6,
              },
              tabBarLabelStyle: {
                fontFamily: theme.fonts.body,
                fontSize: 10,
                letterSpacing: 0.4,
              },
              tabBarActiveTintColor: theme.palette.primary,
              tabBarInactiveTintColor: theme.palette.text.muted,
            }}
          >
            <Tab.Screen
              name="Bibliothek"
              component={Library}
              options={{
                tabBarIcon: ({ color, size }) => <LibraryIcon color={color} size={size} />,
              }}
            />
            <Tab.Screen
              name="Wiedergabe"
              component={NowPlaying}
              options={{
                tabBarIcon: ({ color, size }) => <Disc3 color={color} size={size} />,
              }}
            />
            <Tab.Screen
              name="Playlists"
              component={Playlists}
              options={{
                tabBarIcon: ({ color, size }) => <ListMusic color={color} size={size} />,
              }}
            />
            <Tab.Screen
              name="Equalizer"
              component={Equalizer}
              options={{
                tabBarIcon: ({ color, size }) => <Sliders color={color} size={size} />,
              }}
            />
            <Tab.Screen
              name="Tags"
              component={Id3TagEditor}
              options={{
                tabBarIcon: ({ color, size }) => <Tag color={color} size={size} />,
              }}
            />
            <Tab.Screen
              name="Cover"
              component={Covers}
              options={{
                tabBarIcon: ({ color, size }) => <ImageIcon color={color} size={size} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </MusicProvider>
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
