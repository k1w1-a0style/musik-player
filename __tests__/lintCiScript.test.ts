import fs from 'fs';
import path from 'path';

describe('lint CI script', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };

  it('fails on warnings instead of hiding them', () => {
    const lintCi = packageJson.scripts?.['lint:ci'] ?? '';

    expect(lintCi).toContain('eslint .');
    expect(lintCi).toContain('--max-warnings=0');
    expect(lintCi).not.toContain('--quiet');
  });

  it('does not rely on deprecated external ESLint formatters', () => {
    const lintScripts = Object.entries(packageJson.scripts ?? {}).filter(([name]) =>
      name.startsWith('lint'),
    );

    expect(lintScripts).not.toEqual([]);
    for (const [_name, command] of lintScripts) {
      expect(command).not.toContain('--format compact');
      expect(command).not.toContain('-f compact');
    }
  });

  it('keeps the Android permission gate self-contained for clean checkouts', () => {
    const androidGate = packageJson.scripts?.['check:android-permissions'] ?? '';
    const generatedGate = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'ci', 'checkGeneratedAndroidManifestPermissions.cjs'),
      'utf8',
    );

    expect(androidGate).toBe('node scripts/ci/checkGeneratedAndroidManifestPermissions.cjs');
    expect(generatedGate).toContain(
      "['prebuild', '--platform', 'android', '--no-install', '--clean']",
    );
    expect(generatedGate).toContain('checkAndroidManifestPermissions.cjs');
    expect(generatedGate).toContain('restoreFile(packageJsonPath, packageJsonBefore)');
  });
});
