import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const script = path.join(__dirname, '..', 'checkAndroidBundleDependencies.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateSourceMap, checkExportDirectory } = require(script);
const map = (sources: string[]) => ({ version: 3, sources, mappings: 'AAAA' });

describe('Android production bundle tool dependency boundary', () => {
  it('allows the player sources without mistaking similarly named packages for tooling', () => {
    expect(evaluateSourceMap(map([
      'utils/nativePlaybackWatchdog.ts', '../node_modules/react-native/index.js',
      '../node_modules/node-forge-helper/index.js', '../node_modules/@example/braces/index.js',
    ]))).toEqual({ sourceCount: 4, blocked: [] });
  });

  it.each(['braces', 'micromatch', 'node-forge', 'sprintf-js'])('rejects %s in a player source map', dependency => {
    expect(evaluateSourceMap(map([`../node_modules/${dependency}/index.js`])).blocked).toEqual([dependency]);
  });

  it('handles Windows, nested npm and pnpm paths and deduplicates matches', () => {
    expect(evaluateSourceMap(map([
      'C:\\app\\node_modules\\node-forge\\lib\\index.js',
      '../node_modules/expo/node_modules/node-forge/lib/index.js',
      '../node_modules/.pnpm/braces@3.0.3/node_modules/braces/index.js',
    ])).blocked).toEqual(['braces', 'node-forge']);
  });

  it('checks embedded indexed map sections rather than ignoring their sources', () => {
    expect(evaluateSourceMap({ version: 3, sections: [{ map: map(['node_modules/braces/index.js']) }] }).blocked)
      .toEqual(['braces']);
  });

  it.each([{}, { version: 2, sources: ['app.ts'] }, { version: 3 }, map([]), { version: 3, sources: [null] }])(
    'fails closed for missing, empty or malformed source map data: %j', candidate => {
      expect(() => evaluateSourceMap(candidate)).toThrow();
    },
  );

  it('enforces source map validation on the real CLI path and rejects a missing map', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwi-bundle-boundary-'));
    try {
      expect(() => checkExportDirectory(directory)).toThrow('contains no source maps');
      const filename = path.join(directory, 'android.hbc.map');
      fs.writeFileSync(filename, JSON.stringify(map(['app.ts'])));
      expect(checkExportDirectory(directory)).toEqual({ mapCount: 1, sourceCount: 1 });
      fs.writeFileSync(filename, JSON.stringify(map(['node_modules/node-forge/lib/index.js'])));
      const result = spawnSync(process.execPath, [script, directory], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('node-forge');
      fs.writeFileSync(filename, '{invalid json');
      expect(() => checkExportDirectory(directory)).toThrow();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
