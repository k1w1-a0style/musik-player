import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlayerScreen } from './player';
import { PlaylistScreen } from './playlist';
import { MusicLibraryScreen } from './music-library';
const Tab = createBottomTabNavigator();
export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name='Player' component={PlayerScreen} />
        <Tab.Screen name='Playlist' component={PlaylistScreen} />
        <Tab.Screen name='Music Library' component={MusicLibraryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}