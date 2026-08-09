/* eslint-disable @typescript-eslint/no-require-imports -- ordered startup loads are the privacy boundary */
// Use ordered CommonJS loads here: static imports are evaluated before this module's
// body and could emit diagnostics before the global redaction boundary exists.
const { installDiagnosticConsoleSanitizer } = require('./utils/diagnosticSanitizer');
installDiagnosticConsoleSanitizer();

const { registerRootComponent } = require('expo');
const TrackPlayer = require('react-native-track-player').default;
const App = require('./App').default;
const { PlaybackService } = require('./services/PlaybackService');

TrackPlayer.registerPlaybackService(() => PlaybackService);
registerRootComponent(App);
