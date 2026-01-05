import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MusicProvider } from './contexts/MusicContext';
import MusicPlayer from './screens/MusicPlayer';
import Playlists from './screens/Playlists';
import Equalizer from './screens/Equalizer';
import Library from './screens/Library';
import { registerForPushNotificationsAsync } from './utils/pushNotifications';

const Stack = createNativeStackNavigator();

const App = () => {
  useEffect(() => {
    // Register for push notifications on app start
    registerForPushNotificationsAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MusicProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="MusicPlayer"
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="MusicPlayer" component={MusicPlayer} />
            <Stack.Screen name="Library" component={Library} />
            <Stack.Screen name="Playlists" component={Playlists} />
            <Stack.Screen name="Equalizer" component={Equalizer} />
          </Stack.Navigator>
        </NavigationContainer>
      </MusicProvider>
    </GestureHandlerRootView>
  );
};

export default App;
