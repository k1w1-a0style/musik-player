import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { PlaybackService } from './services/PlaybackService';
import { installDiagnosticConsoleSanitizer } from './utils/diagnosticSanitizer';

installDiagnosticConsoleSanitizer();
TrackPlayer.registerPlaybackService(() => PlaybackService);
registerRootComponent(App);
