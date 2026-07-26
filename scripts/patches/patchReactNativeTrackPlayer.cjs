const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const PATTERN_NOT_FOUND_HINT = [
  'Check the installed RNTP version,',
  'remove or update this patch when upgrading TrackPlayer,',
  'then run npm install again.',
].join(' ');
const pkgPath = path.join(rootDir, 'node_modules', 'react-native-track-player', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('[patch-react-native-track-player] Skipping: react-native-track-player is not installed.');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== '4.1.2') {
  console.error(
    `[patch-react-native-track-player] ERROR: expected version 4.1.2, found ${pkg.version}. ` +
    'Refusing to continue because the required patch has not been verified for this dependency version.',
  );
  process.exit(1);
}

const moduleKtPath = path.join(
  rootDir,
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'module',
  'MusicModule.kt',
);

const serviceKtPath = path.join(
  rootDir,
  'node_modules',
  'react-native-track-player',
  'android',
  'src',
  'main',
  'java',
  'com',
  'doublesymmetry',
  'trackplayer',
  'service',
  'MusicService.kt',
);

for (const [label, filePath] of [['MusicModule.kt', moduleKtPath], ['MusicService.kt', serviceKtPath]]) {
  if (!fs.existsSync(filePath)) {
    console.error(`[patch-react-native-track-player] ERROR: ${label} was not found.`);
    process.exit(1);
  }
}

let content = fs.readFileSync(moduleKtPath, 'utf8');

if (!content.includes('import android.os.Bundle')) {
  content = content.replace('import android.os.Build', 'import android.os.Build\nimport android.os.Bundle');
}

const replacements = [
  {
    from: 'Arguments.fromBundle(musicService.tracks[index].originalItem)',
    to: 'Arguments.fromBundle(musicService.tracks[index].originalItem ?: Bundle())',
  },
  {
    from: 'musicService.tracks[musicService.getCurrentTrackIndex()].originalItem',
    to: 'musicService.tracks[musicService.getCurrentTrackIndex()].originalItem ?: Bundle()',
  },
];

for (const { from, to } of replacements) {
  if (content.includes(to)) {
    continue;
  }
  if (!content.includes(from)) {
    console.error(
      `[patch-react-native-track-player] ERROR: Expected pattern not found: ${from}. ${PATTERN_NOT_FOUND_HINT}`,
    );
    process.exit(1);
  }
  content = content.replace(from, to);
}

const audioSessionMethod = `    @ReactMethod
    fun getAudioSessionId(callback: Promise) = scope.launch {
        if (verifyServiceBoundOrReject(callback)) return@launch

        callback.resolve(musicService.getAudioSessionId())
    }

`;
const audioSessionInsertionPoint = `    @ReactMethod
    fun setRate(rate: Float, callback: Promise) = scope.launch {`;
if (!content.includes(audioSessionMethod)) {
  if (!content.includes(audioSessionInsertionPoint)) {
    console.error(
      `[patch-react-native-track-player] ERROR: Expected audio-session insertion point was not found. ${PATTERN_NOT_FOUND_HINT}`,
    );
    process.exit(1);
  }
  content = content.replace(audioSessionInsertionPoint, audioSessionMethod + audioSessionInsertionPoint);
}

fs.writeFileSync(moduleKtPath, content, 'utf8');

let serviceContent = fs.readFileSync(serviceKtPath, 'utf8');
if (!serviceContent.includes('import com.google.android.exoplayer2.ExoPlayer')) {
  const importPoint = 'import com.google.android.exoplayer2.ui.R as ExoPlayerR';
  if (!serviceContent.includes(importPoint)) {
    console.error(
      `[patch-react-native-track-player] ERROR: Expected MusicService import point was not found. ${PATTERN_NOT_FOUND_HINT}`,
    );
    process.exit(1);
  }
  serviceContent = serviceContent.replace(
    importPoint,
    `import com.google.android.exoplayer2.ExoPlayer
${importPoint}`,
  );
}

const serviceAudioSessionMethod = `    @MainThread
    fun getAudioSessionId(): Int? {
        val exoPlayer = try {
            var type: Class<*>? = player.javaClass
            var resolved: ExoPlayer? = null
            while (type != null && resolved == null) {
                val field = type.declaredFields.firstOrNull {
                    ExoPlayer::class.java.isAssignableFrom(it.type)
                }
                if (field != null) {
                    field.isAccessible = true
                    resolved = field.get(player) as? ExoPlayer
                }
                type = type.superclass
            }
            resolved
        } catch (_: Throwable) {
            null
        }
        return exoPlayer?.audioSessionId?.takeIf { it > 0 }
    }

`;
const serviceInsertionPoint = `    @MainThread
    fun getRate(): Float = player.playbackSpeed`;
if (!serviceContent.includes(serviceAudioSessionMethod)) {
  if (!serviceContent.includes(serviceInsertionPoint)) {
    console.error(
      `[patch-react-native-track-player] ERROR: Expected MusicService audio-session insertion point was not found. ${PATTERN_NOT_FOUND_HINT}`,
    );
    process.exit(1);
  }
  serviceContent = serviceContent.replace(serviceInsertionPoint, serviceAudioSessionMethod + serviceInsertionPoint);
}
fs.writeFileSync(serviceKtPath, serviceContent, 'utf8');

console.log('[patch-react-native-track-player] Applied nullability and player audio-session patches for react-native-track-player@4.1.2.');
