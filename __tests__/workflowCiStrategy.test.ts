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

const easConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'eas.json'), 'utf8'));

const apkContractViolations = (
  config: typeof easConfig,
  workflow: string,
  expectedArtifactPath: string,
  expectedArtifactName: string,
) => {
  const nonApkProfiles = Object.entries(config.build).flatMap(([profile, value]) =>
    !(value as { android?: { buildType?: string } }).android
      || (value as { android: { buildType?: string } }).android.buildType === 'apk'
      ? [] : [profile]
  );

  return [
    ...(nonApkProfiles.length === 0 ? [] : [`Non-APK Android profiles: ${nonApkProfiles.join(', ')}`]),
    ...(workflow.includes('ARTIFACT_EXT=apk') ? [] : ['Workflow artifact extension is not APK']),
    ...(workflow.includes(expectedArtifactPath)
      ? []
      : ['Downloaded artifact name does not use the APK extension']),
    ...(workflow.includes(expectedArtifactName)
      ? []
      : ['Published artifact name is not APK-specific']),
    ...(workflow.includes('- name: Upload Android APK Artifact')
      ? []
      : ['Uploaded artifact is not identified as an Android APK']),
    ...(workflow.includes('node scripts/ci/inspectAndroidApk.cjs')
      ? []
      : ['Canonical APK inspector is not used']),
    ...(/\b(?:aab|app-bundle)\b|\.aab\b/i.test(workflow)
      ? ['An AAB or App Bundle assumption is configured']
      : []),
  ];
};

const stepBlocks = (workflow: string) =>
  workflow
    .split(/\n(?=\s{6,}- name: )/)
    .filter(block => /^\s{6,}- name: /m.test(block));

describe('GitHub workflow CI strategy', () => {
  const workflowContracts = [
    {
      file: 'eas-build.yml',
      artifactPath: 'k1w1-${{ inputs.profile }}.${ARTIFACT_EXT}',
      artifactName: 'eas-${{ inputs.platform }}-${{ inputs.profile }}-${{ github.run_number }}-apk',
    },
    {
      file: 'release-build.yml',
      artifactPath: 'k1w1-${{ inputs.profile }}.${ARTIFACT_EXT}',
      artifactName: 'k1w1-android-${{ inputs.profile }}-${{ github.run_number }}-apk',
    },
  ];

  it.each(workflowContracts)('keeps EAS profiles and $file on one APK-only artifact contract', contract => {
    const workflow = readWorkflow(contract.file);

    expect(apkContractViolations(
      easConfig,
      workflow,
      contract.artifactPath,
      contract.artifactName,
    )).toEqual([]);
  });

  it('ignores build profiles that do not target Android', () => {
    const configWithIosProfile = JSON.parse(JSON.stringify(easConfig));
    configWithIosProfile.build.iosOnly = { ios: { simulator: true } };
    const contract = workflowContracts[0];

    expect(apkContractViolations(
      configWithIosProfile,
      readWorkflow(contract.file),
      contract.artifactPath,
      contract.artifactName,
    )).toEqual([]);
  });

  it('rejects a production App Bundle regression across EAS and workflow configuration', () => {
    const regressedConfig = JSON.parse(JSON.stringify(easConfig));
    regressedConfig.build.production.android.buildType = 'app-bundle';

    const contract = workflowContracts[0];
    expect(apkContractViolations(
      regressedConfig,
      readWorkflow(contract.file),
      contract.artifactPath,
      contract.artifactName,
    )).toContain(
      'Non-APK Android profiles: production'
    );
  });

  it.each(workflowContracts)('rejects AAB, naming, extension, and inspector regressions in $file', contract => {
    const workflow = readWorkflow(contract.file);
    const violations = (mutatedWorkflow: string) => apkContractViolations(
      easConfig,
      mutatedWorkflow,
      contract.artifactPath,
      contract.artifactName,
    );

    expect(violations(`${workflow}\n# artifact: release.aab`)).toContain(
      'An AAB or App Bundle assumption is configured'
    );
    expect(violations(`${workflow}\n# buildType: app-bundle`)).toContain(
      'An AAB or App Bundle assumption is configured'
    );
    expect(violations(workflow.replace(contract.artifactPath, 'k1w1-${{ inputs.profile }}.zip')))
      .toContain('Downloaded artifact name does not use the APK extension');
    expect(violations(workflow.replace(contract.artifactName, 'generic-artifact')))
      .toContain('Published artifact name is not APK-specific');
    expect(violations(workflow.replace('node scripts/ci/inspectAndroidApk.cjs', 'echo skipped')))
      .toContain('Canonical APK inspector is not used');
  });

  it('keeps the release APK path non-empty, inspected, and fail-closed before publication', () => {
    const releaseWorkflow = readWorkflow('release-build.yml');

    expect(releaseWorkflow).toContain('if ! test -s "${OUT}"; then');
    expect(releaseWorkflow).toContain('steps.inspect_apk.outcome == \'success\'');
    expect(releaseWorkflow).toContain('path: ${{ steps.download_artifact.outputs.artifact_path }}');
    expect(releaseWorkflow).toContain('if-no-files-found: error');
    expect(releaseWorkflow).not.toContain('continue-on-error: true');
  });

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

  it('keeps main CI triggers limited to active protected branches', () => {
    const ciWorkflow = readWorkflow('ci.yml');

    expect(ciWorkflow).toContain('pull_request:\n    branches: [main, codex]');
    expect(ciWorkflow).toContain('push:\n    branches: [main, codex]');
    expect(ciWorkflow).not.toContain('Emergent');
  });
  it('fails closed when an EAS APK download does not produce an artifact', () => {
    const easWorkflow = readWorkflow('eas-build.yml');

    expect(easWorkflow).toContain('artifact_url=');
    expect(easWorkflow).toContain('https://expo.dev/artifacts/eas/');
    expect(easWorkflow).toContain('curl --fail');
    expect(easWorkflow).not.toContain('eas build:download --id');
    expect(easWorkflow).not.toContain('eas build:download "${BUILD_ID}"');
    expect(easWorkflow).not.toContain('eas build:download "${BUILD_ID}" --output');
    expect(easWorkflow).not.toContain('eas build:download --build-id "${BUILD_ID}" --output');
    const workflowLines = easWorkflow.split('\n');
    const easBuildDownloadInvocations = workflowLines.flatMap((line, index) =>
      /^\s*(?:if )?eas build:download/.test(line) ? [workflowLines.slice(index, index + 4).join('\n')] : []
    );
    expect(easBuildDownloadInvocations.every(command => !command.includes('--output'))).toBe(true);
    expect(easWorkflow).toContain('--build-id "${BUILD_ID}"');
    expect(easWorkflow).toContain('--non-interactive');
    expect(easWorkflow).toContain('--json');
    expect(easWorkflow).toContain('JSON.parse');
    expect(easWorkflow).toContain('j.path');
    expect(easWorkflow).toContain('mv "${DOWNLOADED_APK}" "${OUT}" || cp "${DOWNLOADED_APK}" "${OUT}"');
    expect(easWorkflow).toContain('${RUNNER_TEMP:-/tmp}/k1w1-artifacts');
    expect(easWorkflow).toContain('for attempt in 1 2 3 4 5; do');
    expect(easWorkflow).toContain('Download attempt ${attempt}/5');
    expect(easWorkflow).toContain('download_ok=false');
    expect(easWorkflow).toContain('eas build:download --help');
    expect(easWorkflow).toContain('ci-logs/eas-build-download-help.log');
    expect(easWorkflow).toContain('ci-logs/eas-download.log');
    expect(easWorkflow).toContain('ci-logs/eas-download-attempt-${attempt}.json');
    expect(easWorkflow).toContain('ci-logs/eas-download-attempt-${attempt}.log');
    expect(easWorkflow).toContain('ci-logs/eas-download-attempt-*.json');
    expect(easWorkflow).toContain('ci-logs/eas-download-attempt-*.log');
    expect(easWorkflow).not.toContain('--latest');
    expect(easWorkflow).toContain('eas build:download failed; attempting direct artifact URL fallback.');
    expect(easWorkflow).toContain('Direct EAS artifact URL fallback failed.');
    expect(easWorkflow).toContain('neither eas build:download nor the direct URL fallback produced a non-empty APK');
    expect(easWorkflow).toContain('Build ID=${{ steps.eas.outputs.build_id }}');
    expect(easWorkflow).toContain('Build URL=${{ steps.eas.outputs.build_url }}');
    expect(easWorkflow).toContain('Artifact URL=${{ steps.eas.outputs.artifact_url }}');
    expect(easWorkflow).toContain('Expected output=${OUT}');
    expect(easWorkflow).toContain('find "${ARTIFACT_DIR}" -maxdepth 2 -type f');
    expect(easWorkflow).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(easWorkflow).toContain('--expected-package "${EXPECTED_PACKAGE}"');
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

  it('fails closed for cloud EAS builds while retaining the confirmed manual development smoke', () => {
    for (const file of ['eas-build.yml', 'release-build.yml', 'deploy-supabase-functions.yml']) {
      expect(readWorkflow(file)).toContain("vars.ENABLE_CLOUD_EAS_BUILDS == 'true'");
    }

    const smoke = readWorkflow('android-emulator-smoke.yml');
    expect(smoke).toContain('workflow_dispatch:');
    expect(smoke).toContain("if: github.event.inputs.confirmation == 'BUILD_DEVELOPMENT_APK'");
    expect(smoke).not.toContain('pull_request:');
    expect(smoke).not.toContain('push:');
    expect(smoke).not.toContain('repository_dispatch:');
  });

});
