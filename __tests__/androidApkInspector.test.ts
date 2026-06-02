import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const inspectorScript = path.join(__dirname, '..', 'scripts', 'ci', 'inspectAndroidApk.cjs');

describe('Android APK inspector', () => {
  it('prints APK-like ZIP structure and warns when Android build tools are unavailable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-inspector-'));
    const apk = path.join(dir, 'smoke.apk');

    spawnSync('bash', ['-lc', 'printf manifest > AndroidManifest.xml && printf dex > classes.dex && zip -q smoke.apk AndroidManifest.xml classes.dex'], {
      cwd: dir,
      encoding: 'utf8',
    });

    const result = spawnSync(process.execPath, [inspectorScript, apk], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('zipIntegrity: ok');
    expect(result.stdout).toContain('hasAndroidManifestXml: yes');
    expect(result.stdout).toContain('hasClassesDex: yes');
  });

  it('fails clearly for a missing APK path', () => {
    const result = spawnSync(process.execPath, [inspectorScript, '/tmp/does-not-exist.apk'], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('APK not found');
  });
});
