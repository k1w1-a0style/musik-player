import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from '../node_modules/yaml/dist/index';

const repoRoot = path.join(__dirname, '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const credentials = [
  'EXPO_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
  'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY', 'GITHUB_TOKEN', 'GH_TOKEN',
];
const expo = ['EXPO_TOKEN'];
const supabase = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const signing = [...supabase, 'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY'];
const expectedScopes: Record<string, Record<string, Record<string, string[]>>> = {
  'eas-build.yml': {
    autofix: {
      'Verify EAS auth': expo,
      'Auto-fix repo (lockfile + dev client) [optional writeback]': ['GITHUB_TOKEN'],
    },
    build: {
      'Validate inputs': [...expo, ...signing],
      'Verify EAS auth': expo,
      'Production credential preflight': ['SUPABASE_SERVICE_ROLE_KEY', 'K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY'],
      'Fetch Android keystore (production only)': signing,
      'Update Build Status - Building': supabase,
      'Run EAS Build (WAIT)': expo,
      'Download Android Artifact': expo,
      'Update Build Status - Success': supabase,
      'Update Build Status - Failed': supabase,
    },
  },
  'release-build.yml': {
    build: {
      'Validate secrets + inputs': [...expo, ...signing],
      'Verify EAS auth': expo,
      'Export Android signing files (production only)': signing,
      'Run EAS build (WAIT)': expo,
      'Download Android Artifact': expo,
    },
  },
  'eas-link.yml': {
    link: {
      'Validate secrets': expo,
      'Verify EAS auth (whoami)': expo,
      'EAS project:init (link/create)': expo,
      'Commit changes (if any)': ['GITHUB_TOKEN'],
    },
  },
  'deploy-supabase-functions.yml': {
    'run-eas-build': {
      'Validate Job ID': supabase,
      'Verify EAS auth': expo,
      'Run EAS Build': expo,
      'Update Build Status - Building': supabase,
      'Update Build Status - Success': supabase,
      'Update Build Status - Failed': supabase,
    },
  },
  'android-emulator-smoke.yml': {
    'development-apk-smoke': {
      'Verify EAS auth': expo,
      'Build development APK with EAS locally': expo,
    },
  },
};
const files = Object.keys(expectedScopes);
const load = (file: string): any => YAML.parse(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
const effectiveEnv = (workflow: any, job: any, step: any): Record<string, string> => ({
  ...workflow.env, ...job.env, ...step.env,
});
const credentialKeys = (env: Record<string, string>): string[] => Object.entries(env)
  .filter(([key, value]) => credentials.includes(key) || /\bsecrets\s*[.[]|github\.token/i.test(value))
  .map(([key]) => key).sort();

function scopeFailures(file: string, workflow: any): string[] {
  const failures: string[] = [];
  if (credentialKeys(workflow.env ?? {}).length) failures.push('workflow exposes credentials to every job');
  for (const [jobName, job] of Object.entries<any>(workflow.jobs)) {
    if (credentialKeys(job.env ?? {}).length) failures.push(`${jobName} exposes credentials to every step`);
    for (const [name, expected] of Object.entries(expectedScopes[file][jobName] ?? {})) {
      if (!job.steps.some((step: any) => step.name === name)) failures.push(`${jobName}/${name} is missing`);
      for (const key of expected) {
        const actual = job.steps.find((step: any) => step.name === name)?.env?.[key];
        const expression = key === 'GITHUB_TOKEN' ? '${{ github.token }}' : `\${{ secrets.${key} }}`;
        if (actual !== expression) failures.push(`${jobName}/${name} has no explicit ${key} mapping`);
      }
    }
    for (const step of job.steps) {
      const actual = credentialKeys(effectiveEnv(workflow, job, step));
      const expected = [...(expectedScopes[file][jobName]?.[step.name] ?? [])].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${jobName}/${step.name} credential scope differs`);
      // The pinned setup action writes a supplied token into GITHUB_ENV for later steps.
      if (step.uses?.startsWith('expo/expo-github-action@') && step.with?.token) {
        failures.push(`${jobName}/${step.name} exports its token to subsequent steps`);
      }
    }
  }
  return failures;
}

type Invocation = { command: string; args: string[]; credentials: string[] };
const nonSecretContext: Record<string, string> = {
  'inputs.profile': 'development', 'needs.resolve.outputs.profile': 'development',
  'inputs.platform': 'android', 'inputs.job_id': '550e8400-e29b-41d4-a716-446655440000',
  'github.event.inputs.job_id': '550e8400-e29b-41d4-a716-446655440000',
  'inputs.ref': 'codex', 'needs.authorize.outputs.ref': 'codex',
  'steps.lock.outputs.has_lockfile': 'true', 'steps.lock.outputs.lockfile_path': 'package-lock.json',
  'steps.lock.outputs.package_manager': 'npm', 'steps.strict_lock.outputs.strict': 'false',
  'steps.validate_inputs.outputs.eas_project_id': '', 'steps.validate_inputs.outputs.expo_owner': '',
  'github.run_id': '123', 'github.repository': 'test/music',
  'steps.eas.outputs.build_id': '550e8400-e29b-41d4-a716-446655440000',
  'steps.eas.outputs.build_url': 'https://expo.dev/builds/550e8400-e29b-41d4-a716-446655440000',
};

function renderEnv(env: Record<string, string>, context: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, String(value).replace(
    /\$\{\{\s*([^}]+?)\s*\}\}/g,
    (_match, expression: string) => expression.startsWith('secrets.') || expression === 'github.token'
      ? `scope-canary-${key}` : context[expression] ?? '',
  )]));
}

// Run the actual shell body against local stand-ins. No package installation,
// authentication, git push, or network request can leave this temporary directory.
function executeStep(file: string, jobName: string, name: string, options: {
  workflow?: any;
  context?: Record<string, string>;
  env?: Record<string, string>;
} = {}): Invocation[] {
  const workflow = options.workflow ?? load(file);
  const job = workflow.jobs[jobName];
  const step = job.steps.find((candidate: any) => candidate.name === name);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-secret-scope-'));
  try {
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.mkdirSync(path.join(dir, 'ci-logs'));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(dir, 'ci-logs', 'keystore-request.json'), '{}');
    fs.mkdirSync(path.join(dir, 'scripts', 'ci'), { recursive: true });
    for (const script of ['summarizeKeystoreResponse.cjs', 'writeAndroidSigningFilesFromExport.cjs']) {
      fs.copyFileSync(path.join(repoRoot, 'scripts', 'ci', script), path.join(dir, 'scripts', 'ci', script));
    }
    const stub = `#!${process.execPath}
const fs = require('fs');
const path = require('path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const credentials = ${JSON.stringify(credentials)}.filter(key => Boolean(process.env[key]));
fs.appendFileSync(process.env.SCOPE_LOG, JSON.stringify({command, args, credentials}) + '\\n');
if (command === 'npx' && args.includes('config')) {
  process.stdout.write(JSON.stringify({expo:{extra:{eas:{projectId:'550e8400-e29b-41d4-a716-446655440000'}}}}));
} else if (command === 'npx' && args.includes('--fix') && process.env.SCOPE_FAIL_FIX === 'true') {
  process.exit(1);
} else if (command === 'git' && args[0] === 'status') {
  process.stdout.write(' M package.json\\n');
} else if (command === 'git' && args[0] === 'rev-parse') {
  process.stdout.write('a'.repeat(40) + '\\n');
} else if (command === 'curl') {
  const index = args.findIndex(arg => arg === '-o' || arg === '--output');
  if (index !== -1) fs.writeFileSync(args[index + 1], JSON.stringify({
    ok:true, keystoreBase64:Buffer.alloc(64, 1).toString('base64'),
    keystorePassword:'fixture-password', alias:'fixture-alias', keyPassword:'fixture-password'
  }));
  process.stdout.write('200');
} else if (command === 'eas') {
  process.stdout.write('fixture-user\\n');
}
`;
    for (const command of ['npm', 'npx', 'yarn', 'pnpm', 'corepack', 'eas', 'curl', 'git']) {
      fs.writeFileSync(path.join(bin, command), stub, { mode: 0o755 });
    }
    const environment: NodeJS.ProcessEnv = { ...process.env };
    for (const key of credentials) delete environment[key];
    Object.assign(environment, {
      GITHUB_OUTPUT: path.join(dir, 'output'), GITHUB_ENV: path.join(dir, 'env'),
      GITHUB_REPOSITORY: 'test/music', GITHUB_RUN_ID: '123',
      VALIDATED_JOB_ID: '550e8400-e29b-41d4-a716-446655440000',
      SCOPE_LOG: path.join(dir, 'invocations'),
      ...renderEnv(effectiveEnv(workflow, job, step), { ...nonSecretContext, ...options.context }),
      ...options.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    });
    const result = spawnSync('bash', ['-c', step.run.replaceAll('/tmp/expo-config.json', path.join(dir, 'expo-config.json'))], {
      cwd: dir, env: environment, encoding: 'utf8', timeout: 10000,
    });
    if (result.status !== 0) throw new Error(`${file}/${name}: ${result.stderr || result.error || result.stdout}`);
    const log = path.join(dir, 'invocations');
    return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('workflow credential scopes', () => {
  test.each(files)('%s grants only the credentials each operation needs', file => {
    expect(scopeFailures(file, load(file))).toEqual([]);
  });

  test.each(files)('rejects broad credentials in %s even when step env omits them', file => {
    const workflow = load(file);
    const job = Object.values<any>(workflow.jobs).find(candidate => candidate.steps.some((step: any) => /npm (?:ci|i |install)/.test(step.run ?? '')));
    job.env = { ...job.env, SUPABASE_SERVICE_ROLE_KEY: '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' };
    expect(scopeFailures(file, workflow)).not.toEqual([]);
  });

  test.each(['deploy-supabase-functions.yml', 'android-emulator-smoke.yml'])('rejects action token export in %s', file => {
    const workflow = load(file);
    const setup = Object.values<any>(workflow.jobs).flatMap(job => job.steps).find(step => step.uses?.startsWith('expo/expo-github-action@'));
    setup.with.token = '${{ secrets.EXPO_TOKEN }}';
    expect(scopeFailures(file, workflow)).toEqual(expect.arrayContaining([expect.stringContaining('subsequent steps')]));
  });

  test('rejects a secret hidden under an unrelated environment variable', () => {
    const workflow = load('release-build.yml');
    workflow.env = { CONFIG_DATA: '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' };
    expect(scopeFailures('release-build.yml', workflow)).not.toEqual([]);
  });

  test('rejects Supabase admin credentials accidentally granted to EAS build', () => {
    const workflow = load('eas-build.yml');
    const build = workflow.jobs.build.steps.find((step: any) => step.name === 'Run EAS Build (WAIT)');
    build.env.K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY = '${{ secrets.K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY }}';
    expect(scopeFailures('eas-build.yml', workflow)).not.toEqual([]);
  });
});

describe('actual workflow subprocess environments', () => {
  const installs = files.flatMap(file => Object.entries<any>(load(file).jobs).flatMap(([jobName, job]) => job.steps
    .filter((step: any) => /npm (?:ci|i -g|install --no-audit)/.test(step.run ?? '') && !step.name.startsWith('Auto-fix repo'))
    .map((step: any) => [file, jobName, step.name] as const)));

  test.each(installs)('%s/%s/%s installs with no privileged credential', (file, jobName, name) => {
    const invocations = executeStep(file, jobName, name);
    expect(invocations.some(call => ['npm', 'yarn', 'pnpm'].includes(call.command))).toBe(true);
    expect(invocations.every(call => call.credentials.length === 0)).toBe(true);
  });

  test.each(['yarn', 'pnpm'])('package-manager-aware install branches do not inherit credentials: %s', manager => {
    for (const [file, jobName, name] of installs.filter(([, , name]) => !name.includes('EAS CLI') && name !== 'Install dependencies')) {
      const calls = executeStep(file, jobName, name, { context: { 'steps.lock.outputs.package_manager': manager } });
      expect(calls.some(call => call.command === manager)).toBe(true);
      expect(calls.every(call => call.credentials.length === 0)).toBe(true);
    }
  });

  test('canary observes inherited job credentials if broad scope is reintroduced', () => {
    const workflow = load('release-build.yml');
    workflow.jobs.build.env.SUPABASE_SERVICE_ROLE_KEY = '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}';
    const calls = executeStep('release-build.yml', 'build', 'Install deps (package-manager-aware)', { workflow });
    expect(calls.find(call => call.command === 'npm')?.credentials).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });

  test.each([false, true])('autofix strips tokens for package changes and keeps writeback authorized (fallback=%s)', failFix => {
    const calls = executeStep('eas-build.yml', 'autofix', 'Auto-fix repo (lockfile + dev client) [optional writeback]', {
      context: { 'steps.lock.outputs.has_lockfile': 'false' }, env: { SCOPE_FAIL_FIX: String(failFix) },
    });
    const packageCalls = calls.filter(call => call.command === 'npx' || call.command === 'npm' && call.args[0] === 'install');
    expect(packageCalls).toHaveLength(failFix ? 3 : 2);
    expect(packageCalls.every(call => call.credentials.length === 0)).toBe(true);
    expect(calls.find(call => call.command === 'git' && call.args[0] === 'push')?.credentials).toEqual(['GITHUB_TOKEN']);
  });

  test('canary detects a removed autofix subprocess sanitizer', () => {
    const workflow = load('eas-build.yml');
    const step = workflow.jobs.autofix.steps.find((step: any) => step.name.startsWith('Auto-fix repo (lockfile'));
    step.run = step.run.replaceAll('env -u GITHUB_TOKEN -u GH_TOKEN -u EXPO_TOKEN ', '');
    const calls = executeStep('eas-build.yml', 'autofix', step.name, { workflow });
    expect(calls.find(call => call.command === 'npx')?.credentials).toEqual(['GITHUB_TOKEN']);
  });

  test('EAS link has Expo credentials while local Expo config has none', () => {
    const calls = executeStep('eas-link.yml', 'link', 'EAS project:init (link/create)');
    expect(calls.find(call => call.command === 'eas')?.credentials).toEqual(expo);
    const config = calls.find(call => call.command === 'npx');
    expect(config?.credentials).toEqual([]);
    expect(config?.args).toContain('--no-install');
  });

  test('canary detects a removed Expo config sanitizer', () => {
    const workflow = load('eas-link.yml');
    const step = workflow.jobs.link.steps.find((step: any) => step.name.startsWith('EAS project:init'));
    step.run = step.run.replace('env -u EXPO_TOKEN -u GITHUB_TOKEN -u GH_TOKEN ', '');
    const calls = executeStep('eas-link.yml', 'link', step.name, { workflow });
    expect(calls.find(call => call.command === 'npx')?.credentials).toEqual(expo);
  });

  const authSteps = files.flatMap(file => Object.entries<any>(load(file).jobs).flatMap(([jobName, job]) => job.steps
    .filter((step: any) => step.name.startsWith('Verify EAS auth'))
    .map((step: any) => [file, jobName, step.name] as const)));
  test.each(authSteps)('%s/%s/%s authenticates with only Expo credentials', (file, jobName, name) => {
    const calls = executeStep(file, jobName, name);
    expect(calls.find(call => call.command === 'eas' && call.args[0] === 'whoami')?.credentials).toEqual(expo);
  });

  test.each([
    ['eas-build.yml', 'build', 'Fetch Android keystore (production only)'],
    ['release-build.yml', 'build', 'Export Android signing files (production only)'],
  ])('%s signing export retains exactly its Supabase credentials', (file, jobName, name) => {
    const calls = executeStep(file, jobName, name);
    expect(calls.find(call => call.command === 'curl')?.credentials).toEqual(signing);
  });

  test.each(['eas-build.yml', 'deploy-supabase-functions.yml'])('%s status updates receive no Expo or admin credentials', file => {
    const jobName = file === 'eas-build.yml' ? 'build' : 'run-eas-build';
    for (const phase of ['Building', 'Success', 'Failed']) {
      const calls = executeStep(file, jobName, `Update Build Status - ${phase}`);
      expect(calls.find(call => call.command === 'curl')?.credentials).toEqual(supabase);
    }
  });
});
