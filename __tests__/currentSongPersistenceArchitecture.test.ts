import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const productionRoots = ['screens', 'components', 'navigation', 'contexts', 'hooks', 'utils', 'services'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const coordinatorPath = path.normalize('utils/currentSongPersistence.ts');

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(repoRoot, absolute);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'coverage' || entry.name === '.git') {
        return [];
      }
      return walk(absolute);
    }

    if (!entry.isFile()) return [];
    if (!sourceExtensions.has(path.extname(entry.name))) return [];
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return [];
    return [relative];
  });
};

const directWritePatterns = [
  /storage\s*\.\s*set\s*\(\s*StorageKeys\s*\.\s*CURRENT_SONG_ID/g,
  /storage\s*\.\s*remove\s*\(\s*StorageKeys\s*\.\s*CURRENT_SONG_ID/g,
  /storage\s*\.\s*setCurrentSongId\s*\(/g,
];

test('all production current-song id writes use the shared persistence coordinator', () => {
  const violations = productionRoots
    .flatMap(root => walk(path.join(repoRoot, root)))
    .sort()
    .flatMap(relativePath => {
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath === coordinatorPath) return [];
      const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
      return directWritePatterns.flatMap(pattern =>
        (content.match(pattern) ?? []).map(match => `${normalizedPath}: ${match}`));
    });

  expect(violations).toEqual([]);
});
