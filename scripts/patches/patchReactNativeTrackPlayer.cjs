const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, 'node_modules', 'react-native-track-player', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('[patch-react-native-track-player] Skipping: react-native-track-player is not installed.');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.version !== '4.1.2') {
  console.log(`[patch-react-native-track-player] Skipping: expected version 4.1.2, found ${pkg.version}.`);
  process.exit(0);
}

const ktPath = path.join(
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

if (!fs.existsSync(ktPath)) {
  console.error('[patch-react-native-track-player] ERROR: MusicModule.kt was not found.');
  process.exit(1);
}

let content = fs.readFileSync(ktPath, 'utf8');

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
    console.error(`[patch-react-native-track-player] ERROR: Expected pattern not found: ${from}`);
    process.exit(1);
  }
  content = content.replace(from, to);
}

fs.writeFileSync(ktPath, content, 'utf8');
console.log('[patch-react-native-track-player] Applied Kotlin nullability patch for react-native-track-player@4.1.2.');
