/* eslint-disable @typescript-eslint/no-require-imports -- ordered startup loads are the privacy boundary */
// Use ordered CommonJS loads here: static imports are evaluated before this module's
// body and could emit diagnostics before the global redaction boundary exists.
const { installDiagnosticConsoleSanitizer } = require('./utils/diagnosticSanitizer');
installDiagnosticConsoleSanitizer();

const { registerRootComponent } = require('expo');
const React = require('react');
const TrackPlayer = require('react-native-track-player').default;
const { PlaybackService } = require('./services/PlaybackService');

TrackPlayer.registerPlaybackService(() => PlaybackService);
// Screens are loaded only when the UI renders, never by a cold playback task.
function LazyApp(props) {
  const App = require('./App').default;
  return React.createElement(App, props);
}
registerRootComponent(LazyApp);
