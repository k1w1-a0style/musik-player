import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const inspectorScript = path.join(__dirname, '..', 'scripts', 'ci', 'inspectAndroidAppBundle.cjs');

const makeBundleLikeZip = (includeDex = true) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aab-inspector-'));
  const bundle = path.join(dir, 'smoke.aab');
  const command = [
    'mkdir -p base/manifest base/dex',
    'printf config > BundleConfig.pb',
    'printf manifest > base/manifest/AndroidManifest.xml',
    ...(includeDex ? ['printf dex > base/dex/classes.dex'] : []),
    `zip -q smoke.aab BundleConfig.pb base/manifest/AndroidManifest.xml${includeDex ? ' base/dex/classes.dex' : ''}`,
  ].join(' && ');
  const zipResult = spawnSync('bash', ['-lc', command], { cwd: dir, encoding: 'utf8' });
  expect(zipResult.status).toBe(0);
  return { bundle, dir };
};

const makeFailingJarsignerPath = () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aab-inspector-bin-'));
  const jarsigner = path.join(binDir, 'jarsigner');
  fs.writeFileSync(jarsigner, '#!/usr/bin/env bash\necho "UNSIGNED" >&2\nexit 1\n', 'utf8');
  fs.chmodSync(jarsigner, 0o755);
  return binDir;
};

const makeAndroidUploadJarsignerPath = () => {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aab-inspector-bin-'));
  const jarsigner = path.join(binDir, 'jarsigner');
  fs.writeFileSync(jarsigner, [
    '#!/usr/bin/env bash',
    'if [[ " $* " == *" -strict "* ]]; then',
    '  echo "jar verified, with signer errors."',
    '  echo "This jar contains entries whose signer certificate is self-signed." >&2',
    '  exit 4',
    'fi',
    'echo "jar verified."',
    'exit 0',
    '',
  ].join('\n'), 'utf8');
  fs.chmodSync(jarsigner, 0o755);
  return binDir;
};

describe('Android App Bundle inspector', () => {
  it('accepts a structurally complete bundle when signature enforcement is optional', () => {
    const { bundle, dir } = makeBundleLikeZip();
    const binDir = makeFailingJarsignerPath();

    const result = spawnSync(process.execPath, [inspectorScript, bundle], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
    });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('zipIntegrity: ok');
    expect(result.stdout).toContain('hasBundleConfig: yes');
    expect(result.stdout).toContain('hasBaseManifest: yes');
    expect(result.stdout).toContain('hasBaseDex: yes');
    expect(result.stdout).toContain('signatureStatus: failed');
  });

  it('fails when the base dex payload is missing', () => {
    const { bundle, dir } = makeBundleLikeZip(false);
    const result = spawnSync(process.execPath, [inspectorScript, bundle], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('base/dex/classes*.dex');
  });

  it('fails closed when a required signature cannot be verified', () => {
    const { bundle, dir } = makeBundleLikeZip();
    const binDir = makeFailingJarsignerPath();
    const result = spawnSync(process.execPath, [inspectorScript, bundle, '--require-signature'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
    });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('signatureStatus: failed');
  });

  it('verifies an Android upload-key signature without requiring a public trust chain', () => {
    const { bundle, dir } = makeBundleLikeZip();
    const binDir = makeAndroidUploadJarsignerPath();
    const result = spawnSync(process.execPath, [inspectorScript, bundle, '--require-signature'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` },
    });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('signatureStatus: verified');
  });

  it('rejects a non-AAB extension', () => {
    const result = spawnSync(process.execPath, [inspectorScript, '/tmp/release.apk'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Expected an .aab file');
  });
});
