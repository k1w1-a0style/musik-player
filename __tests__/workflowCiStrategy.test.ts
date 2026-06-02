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

    expect(easWorkflow).toContain('EAS build succeeded, but eas build:download failed');
    expect(easWorkflow).toContain('EAS build succeeded, but no non-empty APK was written');
    expect(easWorkflow).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(easWorkflow).toContain('if-no-files-found: error');
    expect(easWorkflow).not.toContain('- name: Upload Artifact\n        if: always()\n        continue-on-error: true');
  });

});
