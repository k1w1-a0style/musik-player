import fs from 'fs';
import path from 'path';
import YAML from '../node_modules/yaml/dist/index';

const repoRoot = path.join(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const workflowFiles = fs
  .readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort();

const readWorkflow = (file: string) =>
  fs.readFileSync(path.join(workflowDir, file), 'utf8');
const parseWorkflow = (file: string) => YAML.parse(readWorkflow(file));
const parsedNamedStep = (file: string, name: string): any =>
  Object.values(parseWorkflow(file).jobs).flatMap((job: any) => job.steps ?? []).find((step: any) => step.name === name);
const parsedNamedStepFromSource = (source: string, name: string): any =>
  Object.values(YAML.parse(source).jobs).flatMap((job: any) => job.steps ?? []).find((step: any) => step.name === name);
const envVariableFor = (step: any, expression: string): string | undefined =>
  Object.entries(step?.env ?? {}).find(([, value]) => value === expression)?.[0];
const usesEnvExpression = (step: any, expression: string): boolean => {
  const variable = envVariableFor(step, expression);
  return Boolean(variable && step.run.includes(`\${${variable}}`) && !step.run.includes(expression));
};

const easConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'eas.json'), 'utf8'));

const apkContractViolations = (
  config: typeof easConfig,
  workflow: string,
) => {
  const nonApkProfiles = Object.entries(config.build).flatMap(([profile, value]) =>
    !(value as { android?: { buildType?: string } }).android
      || (value as { android: { buildType?: string } }).android.buildType === 'apk'
      ? [] : [profile]
  );

  return [
    ...(nonApkProfiles.length === 0 ? [] : [`Non-APK Android profiles: ${nonApkProfiles.join(', ')}`]),
    ...(workflow.includes('ARTIFACT_EXT=apk') ? [] : ['Workflow artifact extension is not APK']),
    ...((usesEnvExpression(parsedNamedStepFromSource(workflow, 'Download Android Artifact'), '${{ inputs.profile }}')
      || usesEnvExpression(parsedNamedStepFromSource(workflow, 'Download Android Artifact'), '${{ needs.resolve.outputs.profile }}'))
      && /k1w1-\$\{[A-Za-z_][A-Za-z0-9_]*\}\.\$\{ARTIFACT_EXT\}/.test(namedStep(workflow, 'Download Android Artifact'))
      ? []
      : ['Downloaded artifact name does not use the APK extension']),
    ...(/artifact_name=.*-apk/.test(namedStep(workflow, 'Download Android Artifact'))
      || /name:.*-apk/.test(namedStep(workflow, 'Upload Android APK Artifact'))
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

const namedStep = (workflow: string, name: string) =>
  stepBlocks(workflow).find(block => block.includes(`- name: ${name}`)) ?? '';

describe('GitHub workflow CI strategy', () => {
  const workflowContracts = [
    {
      file: 'eas-build.yml',
    },
    {
      file: 'release-build.yml',
    },
  ];

  it.each(workflowContracts)('keeps EAS profiles and $file on one APK-only artifact contract', contract => {
    const workflow = readWorkflow(contract.file);

    expect(apkContractViolations(
      easConfig,
      workflow,
    )).toEqual([]);
  });

  it('ignores build profiles that do not target Android', () => {
    const configWithIosProfile = JSON.parse(JSON.stringify(easConfig));
    configWithIosProfile.build.iosOnly = { ios: { simulator: true } };
    const contract = workflowContracts[0];

    expect(apkContractViolations(
      configWithIosProfile,
      readWorkflow(contract.file),
    )).toEqual([]);
  });

  it('rejects a production App Bundle regression across EAS and workflow configuration', () => {
    const regressedConfig = JSON.parse(JSON.stringify(easConfig));
    regressedConfig.build.production.android.buildType = 'app-bundle';

    const contract = workflowContracts[0];
    expect(apkContractViolations(
      regressedConfig,
      readWorkflow(contract.file),
    )).toContain(
      'Non-APK Android profiles: production'
    );
  });

  it.each(workflowContracts)('rejects AAB, naming, extension, and inspector regressions in $file', contract => {
    const workflow = readWorkflow(contract.file);
    const violations = (mutatedWorkflow: string) => apkContractViolations(
      easConfig,
      mutatedWorkflow,
    );

    expect(violations(`${workflow}\n# artifact: release.aab`)).toContain(
      'An AAB or App Bundle assumption is configured'
    );
    expect(violations(`${workflow}\n# buildType: app-bundle`)).toContain(
      'An AAB or App Bundle assumption is configured'
    );
    expect(violations(workflow.replace('.${ARTIFACT_EXT}', '.zip')))
      .toContain('Downloaded artifact name does not use the APK extension');
    expect(violations(workflow.replace(/artifact_name=([^\n]*-apk)/, 'artifact_name=generic-artifact').replace(/name: ([^\n]*-apk)/, 'name: generic-artifact')))
      .toContain('Published artifact name is not APK-specific');
    expect(violations(workflow.replace('node scripts/ci/inspectAndroidApk.cjs', 'echo skipped')))
      .toContain('Canonical APK inspector is not used');
  });

  it.each(workflowContracts)('gates the APK upload in $file on its inspector step', contract => {
    const workflow = readWorkflow(contract.file);
    const inspectStep = namedStep(workflow, 'Inspect downloaded Android APK');
    const uploadStep = namedStep(workflow, 'Upload Android APK Artifact');

    expect(inspectStep).toContain('id: inspect_apk');
    expect(inspectStep).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(uploadStep).toContain("if: steps.inspect_apk.outcome == 'success'");
  });

  it('keeps the release APK path non-empty, inspected, and fail-closed before publication', () => {
    const releaseWorkflow = readWorkflow('release-build.yml');
    const buildStep = namedStep(releaseWorkflow, 'Run EAS build (WAIT)');
    const downloadStep = namedStep(releaseWorkflow, 'Download Android Artifact');
    const inspectStep = namedStep(releaseWorkflow, 'Inspect downloaded Android APK');
    const uploadStep = namedStep(releaseWorkflow, 'Upload Android APK Artifact');

    expect(releaseWorkflow).toContain('EAS_CLI_VERSION: "16.32.0"');
    expect(buildStep).toContain('resolveEasBuildArtifact.cjs extract-build-id');
    expect(buildStep).not.toMatch(/grep[^\n]*UUID|head -n1[^\n]*UUID/);
    expect(buildStep).not.toContain('artifacts/eas');
    expect(downloadStep).toContain('eas build:view "${BUILD_ID}" --json');
    expect(downloadStep).toContain('resolveEasBuildArtifact.cjs artifact-url');
    expect(downloadStep).toContain('"${BUILD_ID}" "${PROFILE}" "${PROFILE}" "${EXPECTED_DISTRIBUTION}"');
    expect(downloadStep).toContain('development|preview) EXPECTED_DISTRIBUTION="internal"');
    expect(downloadStep).toContain('production) EXPECTED_DISTRIBUTION="store"');
    const download = parsedNamedStep('release-build.yml', 'Download Android Artifact');
    expect(usesEnvExpression(download, '${{ needs.resolve.outputs.profile }}')).toBe(true);
    expect(download.run).toMatch(/OUT="build\/k1w1-\$\{[A-Za-z_][A-Za-z0-9_]*\}\.\$\{ARTIFACT_EXT\}"/);
    expect(downloadStep).toContain('curl --fail --location --retry 3 --retry-delay 5 --output "${OUT}" "${ARTIFACT_URL}"');
    const downloadLogLines = downloadStep.split('\n').filter(line => /\becho\b/.test(line));
    expect(downloadLogLines.every(line => !line.includes('${ARTIFACT_URL}'))).toBe(true);
    expect(downloadStep).not.toContain('artifact_url=');
    expect(releaseWorkflow).not.toContain('--latest');
    expect(releaseWorkflow).not.toContain('eas build:list');
    expect(releaseWorkflow).not.toMatch(/eas build:download[\s\\]*--id[\s\S]{0,200}--output/);
    expect(downloadStep).toContain('if ! test -s "${OUT}"; then');
    expect(inspectStep).toContain('node scripts/ci/inspectAndroidApk.cjs');
    expect(uploadStep).toContain('steps.inspect_apk.outcome == \'success\'');
    expect(uploadStep).toContain('path: ${{ steps.download_artifact.outputs.artifact_path }}');
    expect(uploadStep).toContain('if-no-files-found: error');
    for (const criticalStep of [downloadStep, inspectStep, uploadStep]) {
      expect(criticalStep).not.toContain('continue-on-error');
    }
  });

  it('detects the unsupported release download command mutation', () => {
    const releaseWorkflow = readWorkflow('release-build.yml');
    const unsupportedDownload = /eas build:download[\s\\]*--id[\s\S]{0,200}--output/;
    const mutatedWorkflow = releaseWorkflow.replace(
      'curl --fail --location --retry 3 --retry-delay 5 --output "${OUT}" "${ARTIFACT_URL}"',
      'eas build:download --id "${BUILD_ID}" --output "${OUT}"',
    );

    expect(releaseWorkflow).not.toMatch(unsupportedDownload);
    expect(mutatedWorkflow).toMatch(unsupportedDownload);
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
    expect(ciWorkflow).toContain('push:\n    branches: [main, codex, "fix/**", "refactor/**", "review/**"]');
    expect(ciWorkflow).not.toContain('Emergent');
  });
  it('fails closed when an EAS APK download does not produce an artifact', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const buildStep = namedStep(easWorkflow, 'Run EAS Build (WAIT)');
    const downloadStep = namedStep(easWorkflow, 'Download Android Artifact');

    expect(buildStep).toContain('resolveEasBuildArtifact.cjs extract-build-id');
    expect(buildStep).toContain('resolveEasBuildArtifact.cjs extract-build-url');
    expect(buildStep).toContain('echo "build_id=${BUILD_ID}" >> "${GITHUB_OUTPUT}"');
    expect(buildStep).toContain('echo "build_url=${BUILD_URL}" >> "${GITHUB_OUTPUT}"');
    expect(buildStep).not.toContain('artifacts/eas');
    expect(downloadStep).toContain('eas build:view "${BUILD_ID}" --json');
    expect(downloadStep).toContain('resolveEasBuildArtifact.cjs artifact-url');
    expect(downloadStep).toContain('curl --fail --location --retry 3 --retry-delay 5');
    expect(easWorkflow).not.toContain('eas build:download --id');
    expect(easWorkflow).not.toContain('eas build:download "${BUILD_ID}"');
    expect(easWorkflow).not.toContain('eas build:download "${BUILD_ID}" --output');
    expect(easWorkflow).not.toContain('eas build:download --build-id "${BUILD_ID}" --output');
    expect(easWorkflow).toContain('${RUNNER_TEMP:-/tmp}/k1w1-artifacts');
    expect(easWorkflow).not.toContain('--latest');
    expect(easWorkflow).not.toContain('eas build:list');
    expect(easWorkflow).toContain('validated artifact download did not produce a non-empty APK');
    const download = parsedNamedStep('eas-build.yml', 'Download Android Artifact');
    expect(usesEnvExpression(download, '${{ steps.eas.outputs.build_id }}')).toBe(true);
    const buildIdVariable = envVariableFor(download, '${{ steps.eas.outputs.build_id }}');
    expect(download.run).toContain(`Build ID=\${${buildIdVariable}}`);
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

  it('patches success status with the validated EAS build-detail URL output', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const buildStep = namedStep(easWorkflow, 'Run EAS Build (WAIT)');
    const successStep = namedStep(easWorkflow, 'Update Build Status - Success');
    const success = parsedNamedStep('eas-build.yml', 'Update Build Status - Success');
    const hasBuildUrlProducerForSuccess = (source: string) => {
      const sourceBuildStep = parsedNamedStepFromSource(source, 'Run EAS Build (WAIT)');
      const sourceSuccessStep = parsedNamedStepFromSource(source, 'Update Build Status - Success');
      const sourceBuildUrlVariable = envVariableFor(sourceSuccessStep, '${{ steps.eas.outputs.build_url }}');
      return Boolean(
        sourceBuildUrlVariable
        && sourceSuccessStep.run.includes(`\${${sourceBuildUrlVariable}}`)
        && !sourceSuccessStep.run.includes('${{ steps.eas.outputs.build_url }}')
        && sourceBuildStep.run.includes('echo "build_url=${BUILD_URL}" >> "${GITHUB_OUTPUT}"')
      );
    };

    expect(buildStep).toContain('resolveEasBuildArtifact.cjs extract-build-url');
    expect(buildStep).toContain('echo "build_url=${BUILD_URL}" >> "${GITHUB_OUTPUT}"');
    expect(hasBuildUrlProducerForSuccess(easWorkflow)).toBe(true);
    expect(success.run).not.toContain('steps.eas.outputs.build_url');
    expect(success.run).not.toContain('steps.eas.outputs.build_id');
    expect(success.run).not.toContain('github.event.inputs.job_id');
    expect(success.run).toContain('build_url');
    expect(success.run).toContain('eas_build_id');
    expect(success.run).toContain('curl --fail-with-body');
  });

  it('does not use build URLs or job IDs directly inside privileged shell scripts', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const buildStatusStep = parsedNamedStep('eas-build.yml', 'Update Build Status - Building');
    const successStep = parsedNamedStep('eas-build.yml', 'Update Build Status - Success');
    const failureStep = parsedNamedStep('eas-build.yml', 'Update Build Status - Failed');
    const protectedSteps = [buildStatusStep, successStep, failureStep];

    for (const step of protectedSteps) {
      expect(step.run).not.toContain('${{ inputs.job_id }}');
      expect(step.run).not.toContain('${{ steps.eas.outputs.build_url }}');
      expect(step.run).not.toContain('${{ steps.eas.outputs.build_id }}');
    }
  });

  it('keeps the status payload branch-independent and structured', () => {
    const easWorkflow = readWorkflow('eas-build.yml');
    const success = parsedNamedStep('eas-build.yml', 'Update Build Status - Success');
    const hasBuildUrlProducerForSuccessPayload = (source: string) => {
      const build = parsedNamedStepFromSource(source, 'Run EAS Build (WAIT)');
      const successStep = parsedNamedStepFromSource(source, 'Update Build Status - Success');
      const buildUrlVariable = envVariableFor(successStep, '${{ steps.eas.outputs.build_url }}');
      return Boolean(
        buildUrlVariable
        && successStep.run.includes(`BUILD_URL="\${${buildUrlVariable}}"`)
        && !successStep.run.includes('${{ steps.eas.outputs.build_url }}')
        && build.run.includes('echo "build_url=${BUILD_URL}" >> "${GITHUB_OUTPUT}"')
        && successStep.run.includes('build_url')
      );
    };

    expect(hasBuildUrlProducerForSuccessPayload(easWorkflow)).toBe(true);
    expect(success.run).not.toContain('github.ref');
    expect(success.run).not.toContain('github.head_ref');
    expect(success.run).not.toContain('github.base_ref');
    expect(success.run).not.toContain('github.event.pull_request');
    expect(success.run).not.toContain('github.event.inputs.job_id');
    expect(success.run).not.toContain('steps.eas.outputs.build_url');
    expect(success.run).not.toContain('steps.eas.outputs.build_id');
    expect(success.run).toContain('build_url');
    expect(success.run).toContain('eas_build_id');
    expect(success.run).toContain('JSON.stringify');
    expect(success.run).toContain('curl --fail-with-body');
    expect(success.run).not.toMatch(/-[dD]\s+['"]?\{/);

    expect(hasBuildUrlProducerForSuccessPayload(easWorkflow.replace('${{ steps.eas.outputs.build_url }}', '${{ steps.eas.outputs.build_id }}'))).toBe(false);
    const buildUrlEnv = envVariableFor(success, '${{ steps.eas.outputs.build_url }}')!;
    expect(hasBuildUrlProducerForSuccessPayload(easWorkflow.replace(`BUILD_URL="\${${buildUrlEnv}}"`, 'BUILD_URL="${WRONG_VARIABLE}"'))).toBe(false);
  });

  it('rejects removed, miswired, and directly interpolated secure download env mappings', () => {
    const source = readWorkflow('eas-build.yml');
    const validStep = parsedNamedStepFromSource(source, 'Download Android Artifact');
    const expression = '${{ steps.eas.outputs.build_id }}';
    const variable = envVariableFor(validStep, expression)!;
    expect(usesEnvExpression(validStep, expression)).toBe(true);
    const withoutMapping = { ...validStep, env: { ...validStep.env } };
    delete withoutMapping.env[variable];
    expect(usesEnvExpression(withoutMapping, expression)).toBe(false);
    expect(usesEnvExpression({ ...validStep, env: { ...validStep.env, [variable]: '${{ steps.eas.outputs.build_url }}' } }, expression)).toBe(false);
    expect(usesEnvExpression({ ...validStep, run: validStep.run.replaceAll(`\${${variable}}`, '${WRONG_VARIABLE}') }, expression)).toBe(false);
    expect(usesEnvExpression({ ...validStep, run: `${validStep.run}\necho "${expression}"` }, expression)).toBe(false);
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
    expect(easWorkflow).toContain('eas build:view "${BUILD_ID}" --json');
    expect(easWorkflow).toContain('resolveEasBuildArtifact.cjs artifact-url');
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
    expect(smoke).toContain("if: github.ref == 'refs/heads/codex' && github.event.inputs.confirmation == 'BUILD_DEVELOPMENT_APK'");
    expect(smoke).not.toContain('pull_request:');
    expect(smoke).not.toContain('push:');
    expect(smoke).not.toContain('repository_dispatch:');
  });

});