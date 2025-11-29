import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MusicPlayer from './screens/MusicPlayer';
import Playlists from './screens/Playlists';
import Id3TagEditor from './screens/Id3TagEditor';
import Covers from './screens/Covers';
import Equalizer from './screens/Equalizer';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name='MusicPlayer' component={MusicPlayer} />
        <Stack.Screen name='Playlists' component={Playlists} />
        <Stack.Screen name='Id3TagEditor' component={Id3TagEditor} />
        <Stack.Screen name='Covers' component={Covers} />
        <Stack.Screen name='Equalizer' component={Equalizer} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;