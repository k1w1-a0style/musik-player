import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');

const productionRoots = [
  'screens',
  'components',
  'navigation',
  'contexts',
  'hooks',
  'utils',
  'services',
];

const allowedHardcodedColorFiles = new Set([
  path.normalize('utils/appTheme.ts'),
  path.normalize('utils/appThemeOverlays.ts'),
  path.normalize('utils/jsPaletteFallback.ts'),
]);

const sourceExtensions = new Set(['.ts', '.tsx']);

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(repoRoot, absolute);

    if (entry.isDirectory()) {
      if (
        entry.name === '__tests__' ||
        entry.name === 'node_modules' ||
        entry.name === 'coverage' ||
        entry.name === '.git'
      ) {
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

const readProductionFiles = () =>
  productionRoots
    .flatMap(root => walk(path.join(repoRoot, root)))
    .sort()
    .map(relativePath => ({
      relativePath: path.normalize(relativePath),
      content: fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'),
    }));

describe('theme migration architecture', () => {
  it('does not import the legacy theme module in migrated production UI code', () => {
    const violations = readProductionFiles().flatMap(({ relativePath, content }) => {
      if (!relativePath.startsWith(`components${path.sep}`) && !relativePath.startsWith(`screens${path.sep}`)) {
        return [];
      }

      const legacyThemeImports = content.match(/import\s+(?:[^'"]+?\s+from\s+)?['"](?:\.\.\/)+theme['"];?/g) ?? [];

      return legacyThemeImports.map(match => `${relativePath}: ${match}`);
    });

    expect(violations).toEqual([]);
  });

  it('does not read dynamic colors or gradients from staticTheme in production UI code', () => {
    const violations = readProductionFiles().flatMap(({ relativePath, content }) => {
      const matches = content.match(/staticTheme\.(?:palette|colors|gradients|shadows)/g) ?? [];
      return matches.map(match => `${relativePath}: ${match}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps hardcoded production UI colors inside central theme token files only', () => {
    const violations = readProductionFiles().flatMap(({ relativePath, content }) => {
      if (allowedHardcodedColorFiles.has(relativePath)) return [];

      const matches = content.match(/rgba\(|#[0-9A-Fa-f]{6}\b/g) ?? [];
      return matches.map(match => `${relativePath}: ${match}`);
    });

    expect(violations).toEqual([]);
  });
});
