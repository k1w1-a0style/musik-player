import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const workflowFiles = fs
  .readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort();

const readWorkflow = (file: string) =>
  fs.readFileSync(path.join(workflowDir, file), 'utf8');

const stepBlocks = (workflow: string) =>
  workflow
    .split(/\n(?=\s{6,}- name: )/)
    .filter(block => /^\s{6,}- name: /m.test(block));

describe('GitHub workflow CI strategy', () => {
  it('does not use repository-local actions before checkout', () => {
    const violations = workflowFiles.flatMap(file => {
      const blocks = stepBlocks(readWorkflow(file));
      let sawCheckout = false;

      return blocks.flatMap(block => {
        if (/uses:\s+actions\/checkout@/.test(block)) {
          sawCheckout = true;
        }

        if (!sawCheckout && /^\s{8,}uses:\s+\.\//m.test(block)) {
          return [`${file}: ${block.match(/- name:\s*(.*)/)?.[1] ?? 'unnamed step'}`];
        }

        return [];
      });
    });

    expect(violations).toEqual([]);
  });

  it('does not run full Jest twice in the main CI workflow', () => {
    const ciWorkflow = readWorkflow('ci.yml');

    expect(ciWorkflow).toContain('npm run test:coverage -- --runInBand');
    expect(ciWorkflow).not.toContain('npm test -- --runInBand');
  });

  it('keeps the main CI quality gates explicit and fail-closed', () => {
    const ciWorkflow = readWorkflow('ci.yml');

    expect(ciWorkflow).toContain('npm ci --no-audit --no-fund');
    expect(ciWorkflow).toContain('npm run typecheck');
    expect(ciWorkflow).toContain('npm run test:coverage -- --runInBand');
    expect(ciWorkflow).toContain('npm run lint:ci');
    expect(ciWorkflow).toContain('node scripts/ci/checkExpoReleaseConfig.cjs expo-config.json');
    expect(ciWorkflow).toContain('npm run check:android-permissions');
    expect(ciWorkflow).not.toContain('continue-on-error: true');
  });
  it('fails closed when an EAS APK download does not produce an artifact', () => {
    const easWorkflow = readWorkflow('eas-build.yml');

    expect(easWorkflow).toContain('artifact_url=');
    expect(easWorkflow).toContain('https://expo.dev/artifacts/eas/');
    expect(easWorkflow).toContain('curl --fail');
    expect(easWorkflow).toContain('eas build:download failed; attempting direct artifact URL fallback.');
    expect(easWorkflow).toContain('Direct EAS artifact URL fallback failed.');
    expect(easWorkflow).toContain('neither eas build:download nor the direct URL fallback produced a non-empty APK');
    expect(easWorkflow).toContain('Build ID=${{ steps.eas.outputs.build_id }}');
    expect(easWorkflow).toContain('Build URL=${{ steps.eas.outputs.build_url }}');
    expect(easWorkflow).toContain('Artifact URL=${{ steps.eas.outputs.artifact_url }}');
    expect(easWorkflow).toContain('Expected output=${OUT}');
    expect(easWorkflow).toContain('find build -maxdepth 2 -type f');
    expect(easWorkflow).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(easWorkflow).toContain('--expected-label "k1w1-Musik"');
    expect(easWorkflow).toContain('--min-size-bytes 10000001');
    expect(easWorkflow).toContain('--require-badging');
    expect(easWorkflow).toContain('--require-signature');
    expect(easWorkflow).toContain('EXPECTED_PACKAGE="com.k1w1a0style.musikplayer.dev"');
    expect(easWorkflow).toContain('EXPECTED_PACKAGE="com.k1w1a0style.musikplayer"');
    const uploadAndroidApkBlock = easWorkflow.match(/- name: Upload Android APK Artifact[\s\S]*?if-no-files-found: error/);
    expect(uploadAndroidApkBlock).not.toBeNull();
    expect(easWorkflow).not.toContain('- name: Upload Artifact\n        if: always()\n        continue-on-error: true');
  });

  it('keeps the EAS build job timeout long enough for queued Android dev-client builds', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const autofixJobBlock = easWorkflow.match(/\n  autofix:[\s\S]*?\n  build:/)?.[0] ?? '';
    const buildJobBlock = easWorkflow.match(/\n  build:[\s\S]*?(?=\n  [a-zA-Z0-9_-]+:|\n*$)/)?.[0] ?? '';

    expect(buildJobBlock).toContain('timeout-minutes: 180');
    expect(buildJobBlock).not.toContain('timeout-minutes: 60');
    expect(autofixJobBlock).toContain('timeout-minutes: 30');
    expect(easWorkflow).toContain('default: "development"');
    expect(easWorkflow).not.toContain('default: "preview"');
    expect(easWorkflow).toContain('eas build:download failed; attempting direct artifact URL fallback.');
    expect(easWorkflow).toContain('Direct EAS artifact URL fallback failed.');
    expect(easWorkflow).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(easWorkflow).toContain('--require-badging');
    expect(easWorkflow).toContain('--require-signature');
  });

  it('defaults manual and triggered EAS builds to the development profile', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const triggeredWorkflow = readWorkflow('k1w1-triggered-build.yml');

    expect(easWorkflow).toContain('default: "development"');
    expect(easWorkflow).not.toContain('default: "preview"');
    expect(easWorkflow).toContain('Requested profile:');
    expect(easWorkflow).toContain('Expected EAS environment for profile:');
    expect(easWorkflow).toContain('Expected Android package:');
    expect(easWorkflow).toContain('Expected label:');
    expect(easWorkflow).toContain('com.k1w1a0style.musikplayer.dev');

    expect(triggeredWorkflow).toContain('default: "development"');
    expect(triggeredWorkflow).toContain("|| 'development'");
    expect(triggeredWorkflow).not.toContain('default: "preview"');
    expect(triggeredWorkflow).not.toContain("|| 'preview'");
  });

});
