import fs from 'fs';
import path from 'path';

const navigatorSource = fs.readFileSync(
  path.join(__dirname, '..', 'navigation', 'RootNavigator.tsx'),
  'utf8',
);

const deferredScreens = [
  'TrackInfo',
  'TagEditor',
  'Equalizer',
  'Settings',
  'PlaylistDetail',
  'NowPlaying',
];

test.each(deferredScreens)('defers evaluation of the non-initial %s screen', screen => {
  expect(navigatorSource).not.toMatch(new RegExp(`import\\s+${screen}\\s+from\\s+['"]\\.\\.\\/screens\\/${screen}['"]`));
  expect(navigatorSource).toContain(`getComponent={get${screen}Screen}`);
});
