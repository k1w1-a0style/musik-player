import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MusicPlayer from './screens/MusicPlayer';
// import Playlists from './screens/Playlists'; // Nicht implementiert
// import Id3TagEditor from './screens/Id3TagEditor'; // Nicht implementiert
// import Covers from './screens/Covers'; // Nicht implementiert
// import Equalizer from './screens/Equalizer'; // Nicht implementiert

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MusicPlayer">
        <Stack.Screen name="MusicPlayer" component={MusicPlayer} options={{ title: 'Musik Player' }} />
        {/*
        <Stack.Screen name="Playlists" component={Playlists} />
        <Stack.Screen name="Id3TagEditor" component={Id3TagEditor} />
        <Stack.Screen name="Covers" component={Covers} />
        <Stack.Screen name="Equalizer" component={Equalizer} />
        */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
