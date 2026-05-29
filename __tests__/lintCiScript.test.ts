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
});
