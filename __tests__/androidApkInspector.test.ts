import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const inspectorScript = path.join(__dirname, '..', 'scripts', 'ci', 'inspectAndroidApk.cjs');

const parseBadgingViaNode = (badging: string) => {
  const result = spawnSync(
    process.execPath,
    ['-e', `const { parseBadging } = require(${JSON.stringify(inspectorScript)}); console.log(JSON.stringify(parseBadging(process.argv[1])));`, badging],
    { encoding: 'utf8' },
  );

  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
};

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

  it('parses realistic aapt badging output including label, SDKs, ABIs, and permissions', () => {
    const parsed = parseBadgingViaNode(`package: name='com.k1w1a0style.musikplayer.dev' versionCode='1' versionName='1.0.0'
application-label:'k1w1-Musik'
sdkVersion:'24'
targetSdkVersion:'36'
native-code: 'arm64-v8a' 'armeabi-v7a'
uses-permission: name='android.permission.READ_MEDIA_AUDIO'
uses-permission: name='android.permission.FOREGROUND_SERVICE'`);

    expect(parsed.name).toBe('com.k1w1a0style.musikplayer.dev');
    expect(parsed.applicationLabel).toBe('k1w1-Musik');
    expect(parsed.versionCode).toBe('1');
    expect(parsed.versionName).toBe('1.0.0');
    expect(parsed.minSdkVersion).toBe('24');
    expect(parsed.targetSdkVersion).toBe('36');
    expect(parsed.nativeCode).toBe('arm64-v8a,armeabi-v7a');
    expect(parsed.permissions).toEqual(['android.permission.READ_MEDIA_AUDIO', 'android.permission.FOREGROUND_SERVICE']);
  });
});
