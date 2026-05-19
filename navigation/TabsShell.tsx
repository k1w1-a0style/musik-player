import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ImageIcon, Library as LibraryIcon, ListMusic, Sliders } from 'lucide-react-native';
import type { AppTabParamList } from '../types/navigation';
import { APP_TAB_ROUTES } from '../types/routes';
import Library from '../screens/Library';
import Playlists from '../screens/Playlists';
import Equalizer from '../screens/Equalizer';
import Covers from '../screens/Covers';
import MiniPlayer from '../components/MiniPlayer';
import { theme } from '../theme';

const Tab = createBottomTabNavigator<AppTabParamList>();

interface TabsShellProps {
  openNowPlaying: () => void;
}

const TabsShell: React.FC<TabsShellProps> = ({ openNowPlaying }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.palette.surface,
            borderTopColor: theme.palette.border,
            height: 66 + insets.bottom,
            paddingBottom: Math.max(8, insets.bottom),
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
        <Tab.Screen name={APP_TAB_ROUTES.LIBRARY} component={Library} options={{ tabBarIcon: ({ color, size }) => <LibraryIcon color={color} size={size} /> }} />
        <Tab.Screen name={APP_TAB_ROUTES.PLAYLISTS} component={Playlists} options={{ tabBarIcon: ({ color, size }) => <ListMusic color={color} size={size} /> }} />
        <Tab.Screen name={APP_TAB_ROUTES.EQUALIZER} component={Equalizer} options={{ tabBarIcon: ({ color, size }) => <Sliders color={color} size={size} /> }} />
        <Tab.Screen name={APP_TAB_ROUTES.COVER} component={Covers} options={{ tabBarIcon: ({ color, size }) => <ImageIcon color={color} size={size} /> }} />
      </Tab.Navigator>
      <MiniPlayer onOpen={openNowPlaying} />
    </View>
  );
};

export default TabsShell;
