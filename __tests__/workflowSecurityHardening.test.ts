import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from '../node_modules/yaml/dist/index';

const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
const actionsDir = path.join(process.cwd(), '.github', 'actions');
const workflowFiles = fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name));
const actionManifestFiles = fs.existsSync(actionsDir)
  ? fs.readdirSync(actionsDir, { recursive: true })
    .filter((name): name is string => typeof name === 'string' && /(^|\/)action\.ya?ml$/.test(name))
    .map(name => path.join(actionsDir, name))
  : [];
const load = (name: string) => YAML.parse(fs.readFileSync(path.join(workflowsDir, name), 'utf8'));
const source = (name: string) => fs.readFileSync(path.join(workflowsDir, name), 'utf8');

function runBlocks(document: any): any[] {
  return Object.values(document.jobs || {}).flatMap((job: any) => job.steps || []).filter((step: any) => typeof step.run === 'string');
}

const jobs = (document: any): any[] => Object.values(document.jobs || {});
type PermissionLevel = 0 | 1 | 2;
type PermissionState = {
  defaultLevel: PermissionLevel;
  overrides: Record<string, PermissionLevel>;
  valid: boolean;
};

const permissionState = (permissions: unknown): PermissionState => {
  if (permissions === 'read-all' || permissions === 'write-all') {
    return {
      defaultLevel: permissions === 'write-all' ? 2 : 1,
      overrides: {},
      valid: true,
    };
  }
  if (permissions == null || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return { defaultLevel: 0, overrides: {}, valid: false };
  }
  const overrides: Record<string, PermissionLevel> = {};
  let valid = true;
  for (const [scope, value] of Object.entries(permissions)) {
    if (value === 'write') overrides[scope] = 2;
    else if (value === 'read') overrides[scope] = 1;
    else if (value === 'none') overrides[scope] = 0;
    else valid = false;
  }
  return { defaultLevel: 0, overrides, valid };
};

const effectivePermissions = (workflow: any, job: any): PermissionState =>
  permissionState(hasOwn(job, 'permissions') ? job.permissions : workflow.permissions);

const reusableWorkflowPermissionFailures = (files: Record<string, any>): string[] => {
  const failures: string[] = [];
  for (const [callerName, caller] of Object.entries(files)) {
    for (const [callerJobName, callerJob] of Object.entries<any>(caller.jobs || {})) {
      if (typeof callerJob?.uses !== 'string' || !callerJob.uses.startsWith('./.github/workflows/')) continue;
      const calledName = callerJob.uses.slice('./.github/workflows/'.length);
      const called = files[calledName];
      if (!called) {
        failures.push(`${callerName}:${callerJobName} references missing ${calledName}`);
        continue;
      }
      for (const [calledJobName, calledJob] of Object.entries<any>(called.jobs || {})) {
        const ceiling = effectivePermissions(caller, callerJob);
        const requested = effectivePermissions(called, calledJob);
        if (!ceiling.valid || !requested.valid) {
          failures.push(`${callerName}:${callerJobName} or ${calledName}:${calledJobName} has invalid permissions`);
          continue;
        }
        if (requested.defaultLevel > ceiling.defaultLevel) {
          failures.push(`${callerName}:${callerJobName} grants default permissions below ${calledName}:${calledJobName}`);
        }
        const scopes = new Set([
          ...Object.keys(ceiling.overrides),
          ...Object.keys(requested.overrides),
        ]);
        for (const scope of scopes) {
          const callerLevel = ceiling.overrides[scope] ?? ceiling.defaultLevel;
          const calledLevel = requested.overrides[scope] ?? requested.defaultLevel;
          if (calledLevel > callerLevel) {
            failures.push(`${callerName}:${callerJobName} grants ${scope} below ${calledName}:${calledJobName}`);
          }
        }
      }
    }
  }
  return failures;
};

const easPermissionContractFailures = (caller: any, called: any): string[] => [
  ...reusableWorkflowPermissionFailures({
    'k1w1-triggered-build.yml': caller,
    'eas-build.yml': called,
  }),
  ...(JSON.stringify(caller.permissions) === JSON.stringify({ contents: 'read' })
    ? [] : ['triggered workflow default must be contents: read']),
  ...(JSON.stringify(caller.jobs?.build?.permissions) === JSON.stringify({ contents: 'write' })
    ? [] : ['reusable call ceiling must be contents: write']),
  ...(JSON.stringify(called.permissions) === JSON.stringify({ contents: 'read' })
    ? [] : ['EAS workflow default must be contents: read']),
  ...(called.jobs?.authorize?.permissions === undefined
    ? [] : ['authorize must inherit the read-only default']),
  ...(JSON.stringify(called.jobs?.autofix?.permissions) === JSON.stringify({ contents: 'write' })
    ? [] : ['autofix must retain contents: write']),
  ...(JSON.stringify(called.jobs?.build?.permissions) === JSON.stringify({ contents: 'read' })
    ? [] : ['build must remain contents: read']),
];
const EXTERNAL_USE_WITH_SHA = /^[^\s@]+@[0-9a-f]{40}$/;
const EXPRESSION_IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
const EXACT_FORK_TRUST_BOUNDARY = 'github.event.pull_request.head.repo.fork==false';

const isPinnedExternalUse = (value: unknown): boolean => typeof value === 'string'
  && (value.startsWith('./') || EXTERNAL_USE_WITH_SHA.test(value));

const isInsideRepository = (repoRoot: string, target: string): boolean => {
  const relative = path.relative(repoRoot, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..'
    && !path.isAbsolute(relative) && !relative.split(path.sep).includes('node_modules');
};

const localActionManifest = (repoRoot: string, actionDirectory: string): string | null => {
  for (const name of ['action.yml', 'action.yaml']) {
    const candidate = path.join(actionDirectory, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      const canonical = fs.realpathSync(candidate);
      return isInsideRepository(repoRoot, canonical) ? canonical : null;
    }
  }
  return null;
};

type StepInventory = { steps: any[]; failures: string[] };

const inventoryManifestSteps = (
  manifest: string,
  repoRoot: string,
  checkedManifests: Set<string>,
): StepInventory => {
  if (checkedManifests.has(manifest)) return { steps: [], failures: [] };
  checkedManifests.add(manifest);

  let document: any;
  try {
    document = YAML.parse(fs.readFileSync(manifest, 'utf8'));
  } catch {
    return { steps: [], failures: [`local action manifest is invalid: ${path.relative(repoRoot, manifest)}`] };
  }
  if (document?.runs?.using !== 'composite') return { steps: [], failures: [] };
  const steps = Array.isArray(document.runs.steps) ? document.runs.steps : [];
  return inventoryExecutableSteps(steps, repoRoot, checkedManifests);
};

const inventoryExecutableSteps = (
  steps: any[],
  repoRoot: string,
  checkedManifests = new Set<string>(),
): StepInventory => {
  const inventory: StepInventory = { steps: [], failures: [] };
  for (const step of steps) {
    inventory.steps.push(step);
    if (step?.uses == null) continue;
    if (typeof step.uses !== 'string') {
      inventory.failures.push('uses must be a string');
      continue;
    }
    if (!step.uses.startsWith('./')) continue;
    const actionDirectory = path.resolve(repoRoot, step.uses);
    if (!isInsideRepository(repoRoot, actionDirectory)) {
      inventory.failures.push(`unsafe local action path: ${step.uses}`);
      continue;
    }
    const manifest = localActionManifest(repoRoot, actionDirectory);
    if (!manifest) {
      inventory.failures.push(`local action manifest missing or unsafe: ${step.uses}`);
      continue;
    }
    const nested = inventoryManifestSteps(manifest, repoRoot, checkedManifests);
    inventory.steps.push(...nested.steps);
    inventory.failures.push(...nested.failures);
  }
  return inventory;
};

const pinningFailuresForInventory = (inventory: StepInventory): string[] => [
  ...inventory.failures,
  ...inventory.steps.flatMap(step => {
    if (step?.uses == null || (typeof step.uses === 'string' && step.uses.startsWith('./'))) return [];
    if (typeof step.uses !== 'string') return ['uses must be a string'];
    return EXTERNAL_USE_WITH_SHA.test(step.uses) ? [] : [`unpinned external action: ${step.uses}`];
  }),
];

const stepUsePinningFailures = (steps: any[], repoRoot: string): string[] =>
  pinningFailuresForInventory(inventoryExecutableSteps(steps, repoRoot));

const standaloneManifestInventory = (manifest: string, repoRoot: string): StepInventory => {
  const canonical = fs.realpathSync(manifest);
  return isInsideRepository(repoRoot, canonical)
    ? inventoryManifestSteps(canonical, repoRoot, new Set<string>())
    : { steps: [], failures: [`local action manifest is unsafe: ${path.relative(repoRoot, manifest)}`] };
};

const manifestPinningFailures = (manifest: string, repoRoot: string): string[] =>
  pinningFailuresForInventory(standaloneManifestInventory(manifest, repoRoot));

const checkoutFailuresForInventory = (inventory: StepInventory): any[] => inventory.failures.length > 0
  ? [...inventory.failures]
  : inventory.steps.filter(step => typeof step?.uses === 'string'
    && step.uses.toLowerCase().startsWith('actions/checkout@')
    && step.with?.['persist-credentials'] !== false);

const checkoutCredentialFailures = (steps: any[], repoRoot: string): any[] =>
  checkoutFailuresForInventory(inventoryExecutableSteps(steps, repoRoot));

const runFailuresForInventory = (inventory: StepInventory): any[] => inventory.failures.length > 0
  ? [...inventory.failures]
  : inventory.steps.filter(step => typeof step?.run === 'string' && step.run.includes('${{'));

const runExpressionFailures = (steps: any[], repoRoot: string): any[] =>
  runFailuresForInventory(inventoryExecutableSteps(steps, repoRoot));

const manifestCheckoutCredentialFailures = (manifest: string, repoRoot: string): any[] =>
  checkoutFailuresForInventory(standaloneManifestInventory(manifest, repoRoot));

const manifestRunExpressionFailures = (manifest: string, repoRoot: string): any[] =>
  runFailuresForInventory(standaloneManifestInventory(manifest, repoRoot));

const checkActionFixture = (files: Record<string, string>, entry = './action-a'): string[] => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-action-pinning-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(repoRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    return stepUsePinningFailures([{ uses: entry }], repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
};

const checkActionFixturePolicy = (
  files: Record<string, string>,
  policy: (steps: any[], repoRoot: string) => any[],
  entry = './action-a',
): any[] => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-action-policy-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(repoRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    return policy([{ uses: entry }], repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
};

const checkWorkflowFixtureTrustBoundary = (files: Record<string, string>, workflow: any): any[] => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-trust-boundary-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(repoRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    return prTrustBoundaryFailures(workflow, repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
};

const workflowSteps = (workflow: any): any[] => jobs(workflow).flatMap(job => job.steps || []);

const scanExpressionEnd = (value: string, start: number): number => {
  let quote: "'" | '"' | null = null;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quote === "'") {
      if (character === "'" && value[index + 1] === "'") index += 1;
      else if (character === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (character === '\\') index += 1;
      else if (character === '"') quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '}' && value[index + 1] === '}') return index;
  }
  return -1;
};

const githubExpressionBodies = (value: string): string[] => {
  const bodies: string[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf('${{', cursor);
    if (start < 0) break;
    const bodyStart = start + 3;
    const end = scanExpressionEnd(value, bodyStart);
    if (end < 0) {
      // Invalid expressions cannot run, but retain their body so this security gate fails
      // closed if a malformed future workflow still mentions the secrets context.
      bodies.push(value.slice(bodyStart));
      break;
    }
    bodies.push(value.slice(bodyStart, end));
    cursor = end + 2;
  }
  return bodies;
};

const maskQuotedExpressionText = (expression: string): string => {
  const output = [...expression];
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (quote === "'") {
      output[index] = ' ';
      if (character === "'" && expression[index + 1] === "'") output[++index] = ' ';
      else if (character === "'") quote = null;
    } else if (quote === '"') {
      output[index] = ' ';
      if (character === '\\' && index + 1 < expression.length) output[++index] = ' ';
      else if (character === '"') quote = null;
    } else if (character === "'" || character === '"') {
      quote = character;
      output[index] = ' ';
    }
  }
  return output.join('');
};

const expressionReferencesSecrets = (expression: string): boolean => {
  const unquoted = maskQuotedExpressionText(expression);
  for (const match of unquoted.matchAll(EXPRESSION_IDENTIFIER)) {
    if (match[0].toLowerCase() !== 'secrets') continue;
    const prefix = unquoted.slice(0, match.index).trimEnd();
    if (!prefix.endsWith('.')) return true;
  }
  return false;
};

const hasSecretsContextReference = (value: string): boolean => githubExpressionBodies(value)
  .some(expressionReferencesSecrets);

const hasSecretExpression = (value: unknown): boolean => {
  if (typeof value === 'string') return hasSecretsContextReference(value);
  if (Array.isArray(value)) return value.some(hasSecretExpression);
  if (value == null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => (
    key === 'secrets' && entry === 'inherit'
  ) || hasSecretExpression(entry));
};
const hasOwn = (value: unknown, key: string): boolean => value != null
  && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);

const hasSensitiveEffectivePermissions = (
  workflow: any,
  job: any,
  implicitPermissionsAreSensitive: boolean,
): boolean => {
  const hasJobPermissions = hasOwn(job, 'permissions');
  const hasWorkflowPermissions = hasOwn(workflow, 'permissions');
  if (!hasJobPermissions && !hasWorkflowPermissions) return implicitPermissionsAreSensitive;

  const permissions = hasJobPermissions ? job.permissions : workflow.permissions;
  if (permissions === 'read-all') return false;
  if (permissions === 'write-all') return true;
  if (permissions == null || typeof permissions !== 'object' || Array.isArray(permissions)) return true;
  return Object.values(permissions).some(value => value !== 'read' && value !== 'none');
};

const hasWorkflowTrigger = (on: unknown, triggerName: string): boolean => {
  if (typeof on === 'string') return on === triggerName;
  if (Array.isArray(on)) return on.includes(triggerName);
  return on != null && typeof on === 'object'
    && Object.prototype.hasOwnProperty.call(on, triggerName);
};

const hasExactForkTrustBoundary = (condition: unknown): boolean => {
  if (typeof condition !== 'string') return false;
  const trimmed = condition.trim();
  const wrapped = trimmed.match(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/);
  const expression = wrapped ? wrapped[1] : trimmed;
  return expression.replace(/\s+/g, '') === EXACT_FORK_TRUST_BOUNDARY;
};

const prTrustBoundaryFailures = (workflow: any, repoRoot = process.cwd()): any[] => {
  const targetsPullRequest = hasWorkflowTrigger(workflow.on, 'pull_request_target');
  const pullsCode = hasWorkflowTrigger(workflow.on, 'pull_request') || targetsPullRequest;
  if (!pullsCode) return [];
  const workflowHasSecretEnv = hasSecretExpression(workflow.env);
  return jobs(workflow).filter(job => {
    const stepInventory = inventoryExecutableSteps(job.steps || [], repoRoot);
    const sensitive = workflowHasSecretEnv || hasSecretExpression(job)
      || hasSecretExpression(stepInventory.steps)
      || hasSensitiveEffectivePermissions(workflow, job, targetsPullRequest);
    return (stepInventory.failures.length > 0 || sensitive) && !hasExactForkTrustBoundary(job.if);
  });
};

describe('repository-wide workflow security inventory', () => {
  test('same-repository reusable workflows cannot elevate the caller permission ceiling', () => {
    const workflows = Object.fromEntries(workflowFiles.map(file => [file, load(file)]));
    expect(reusableWorkflowPermissionFailures(workflows)).toEqual([]);
  });

  test.each([
    ['read-all', 'write-all', false],
    ['write-all', 'read-all', true],
    ['write-all', 'write-all', true],
    [{ contents: 'read' }, 'write-all', false],
    [{ contents: 'write' }, 'read-all', false],
    ['read-all', { contents: 'write' }, false],
    ['write-all', { contents: 'write' }, true],
    ['write-all', { contents: 'read' }, true],
    [{ contents: 'read' }, { contents: 'write' }, false],
    [{ contents: 'write' }, { contents: 'read' }, true],
    [{}, { contents: 'read' }, false],
    [{ contents: 'read' }, {}, true],
  ])('compares reusable permission state %j -> %j (safe=%s)',
    (callerPermissions, calledPermissions, safe) => {
      const failures = reusableWorkflowPermissionFailures({
        'caller.yml': {
          permissions: callerPermissions,
          jobs: { call: { uses: './.github/workflows/called.yml' } },
        },
        'called.yml': { jobs: { privileged: { permissions: calledPermissions } } },
      });
      expect(failures.length === 0).toBe(safe);
    });

  test('job-level permissions replace workflow-level permissions on both sides', () => {
    expect(reusableWorkflowPermissionFailures({
      'caller.yml': {
        permissions: { contents: 'read' },
        jobs: {
          call: {
            permissions: { contents: 'write' },
            uses: './.github/workflows/called.yml',
          },
        },
      },
      'called.yml': {
        permissions: 'write-all',
        jobs: { privileged: { permissions: { contents: 'write' } } },
      },
    })).toEqual([]);
  });

  test.each([
    [null, { contents: 'read' }],
    ['read', { contents: 'read' }],
    [{ contents: 'admin' }, { contents: 'read' }],
    [{ contents: 'read' }, ['read-all']],
  ])('fails closed for invalid reusable permissions %j / %j',
    (callerPermissions, calledPermissions) => {
      expect(reusableWorkflowPermissionFailures({
        'caller.yml': {
          permissions: callerPermissions,
          jobs: { call: { uses: './.github/workflows/called.yml' } },
        },
        'called.yml': { jobs: { privileged: { permissions: calledPermissions } } },
      })).toEqual(['caller.yml:call or called.yml:privileged has invalid permissions']);
    });

  test('triggered EAS dispatch keeps write at the reusable-call ceiling only', () => {
    const caller = load('k1w1-triggered-build.yml');
    const called = load('eas-build.yml');
    expect(easPermissionContractFailures(caller, called)).toEqual([]);
  });

  test('EAS permission contract rejects least-privilege mutations', () => {
    const caller = load('k1w1-triggered-build.yml');
    const called = load('eas-build.yml');
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

    const oldCallerCeiling = clone(caller);
    oldCallerCeiling.jobs.build.permissions = { contents: 'read' };
    expect(easPermissionContractFailures(oldCallerCeiling, called)).toEqual(expect.arrayContaining([
      'k1w1-triggered-build.yml:build grants contents below eas-build.yml:autofix',
      'reusable call ceiling must be contents: write',
    ]));

    const globalWrite = clone(caller);
    globalWrite.permissions = { contents: 'write' };
    expect(easPermissionContractFailures(globalWrite, called))
      .toContain('triggered workflow default must be contents: read');

    const writableBuild = clone(called);
    writableBuild.jobs.build.permissions = { contents: 'write' };
    expect(easPermissionContractFailures(caller, writableBuild))
      .toContain('build must remain contents: read');

    const readonlyAutofix = clone(called);
    readonlyAutofix.jobs.autofix.permissions = { contents: 'read' };
    expect(easPermissionContractFailures(caller, readonlyAutofix))
      .toContain('autofix must retain contents: write');
  });

  test.each(workflowFiles)('%s pins every external action to an immutable commit', file => {
    const workflow = load(file);
    for (const job of jobs(workflow)) {
      if (job.uses != null) expect(isPinnedExternalUse(job.uses)).toBe(true);
    }
    expect(stepUsePinningFailures(workflowSteps(workflow), process.cwd())).toEqual([]);
  });

  test.each(actionManifestFiles)('%s standalone local action pins every external dependency', manifest => {
    expect(manifestPinningFailures(manifest, process.cwd())).toEqual([]);
  });

  test.each(['main', 'master', 'v1', 'abcdef1'])('rejects movable action @%s hidden in a local composite', ref => {
    expect(checkActionFixture({
      'action-a/action.yml': `runs:\n  using: composite\n  steps:\n    - uses: owner/action@${ref}\n`,
    })).toEqual([`unpinned external action: owner/action@${ref}`]);
  });

  test('rejects a directly referenced movable external action', () => {
    expect(stepUsePinningFailures([{ uses: 'owner/action@main' }], process.cwd()))
      .toEqual(['unpinned external action: owner/action@main']);
  });

  test.each(['action.yml', 'action.yaml'])('accepts pinned dependency through local %s manifest', manifestName => {
    expect(checkActionFixture({
      [`action-a/${manifestName}`]: `runs:\n  using: composite\n  steps:\n    - uses: owner/action@${'a'.repeat(40)}\n`,
    })).toEqual([]);
  });

  test('recursively rejects a movable dependency in a nested local action', () => {
    expect(checkActionFixture({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yaml': 'runs:\n  using: composite\n  steps:\n    - uses: owner/action@main\n',
    })).toEqual(['unpinned external action: owner/action@main']);
  });

  test('accepts a pinned dependency in a nested local action', () => {
    expect(checkActionFixture({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yaml': `runs:\n  using: composite\n  steps:\n    - uses: owner/action@${'a'.repeat(40)}\n`,
    })).toEqual([]);
  });

  test('terminates safely when local composite actions form a cycle', () => {
    expect(checkActionFixture({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-a\n',
    })).toEqual([]);
  });

  test('fails closed when a referenced local action has no manifest', () => {
    expect(checkActionFixture({ 'action-a/README.md': 'missing manifest' }))
      .toEqual(['local action manifest missing or unsafe: ./action-a']);
  });

  test('rejects local action path traversal outside the repository', () => {
    expect(checkActionFixture({}, './../../outside'))
      .toEqual(['unsafe local action path: ./../../outside']);
  });

  test('validates the real determine-ref composite action trust chain', () => {
    expect(stepUsePinningFailures([{ uses: './.github/actions/determine-ref' }], process.cwd())).toEqual([]);
  });

  test.each([
    'owner/repo/.github/workflows/build.yml@main',
    'owner/repo/.github/workflows/build.yml@master',
    'owner/repo/.github/workflows/build.yml@v1',
    'owner/repo/.github/workflows/build.yml@abcdef1',
  ])('rejects movable external job-level reusable workflow ref %s', value => {
    expect(isPinnedExternalUse(value)).toBe(false);
  });

  test.each([
    './.github/workflows/eas-build.yml',
    `owner/repo/.github/workflows/build.yml@${'a'.repeat(40)}`,
  ])('accepts trusted reusable workflow reference %s', value => {
    expect(isPinnedExternalUse(value)).toBe(true);
  });

  test.each([
    '${{ secrets.FOO }}',
    '${{ Secrets.FOO }}',
    '${{ SECRETS.FOO }}',
    '${{ SeCrEtS.FOO }}',
    "${{ secrets['FOO'] }}",
    "${{ Secrets['FOO'] }}",
    '${{ secrets["FOO"] }}',
    '${{ secrets[matrix.secret_name] }}',
    '${{ SECRETS[matrix.secret_name] }}',
    '${{ secrets[ matrix.secret_name ] }}',
    '${{ env[secrets] }}',
    "${{ secrets[format('{0}_TOKEN', matrix.target)] }}",
    '${{ toJSON(secrets) }}',
    '${{ toJSON(Secrets) }}',
    '${{ secrets }}',
    '${{ SECRETS }}',
    "${{ contains(toJSON(secrets), 'TOKEN') }}",
    'first=${{ vars.SAFE }} second=${{ toJSON(secrets) }}',
    "${{ format('{{{0}}}', secrets.FOO) }}",
    "${{ format('{{{0}}}', Secrets.FOO) }}",
    "${{ format('}}', secrets.FOO) }}",
    "${{ format('{{', secrets.FOO) }}",
    "${{ '}}' }}-${{ secrets.FOO }}",
    'prefix-${{ vars.SAFE }}-${{ toJSON(secrets) }}-suffix',
    "prefix ${{ vars.SAFE }} middle ${{ format('}}', SECRETS.FOO) }}",
    "${{ contains('}}', secrets[matrix.secret_name]) }}",
    "${{ format('it''s }} safe', secrets.FOO) }}",
    '${{\n  format(\'quoted }}\',\n    secrets.FOO)\n}}',
  ])('detects secret expression syntax %s', value => {
    expect(hasSecretExpression({ env: { TOKEN: value } })).toBe(true);
  });

  test.each([
    'do not print secrets',
    'secrets documentation',
    '${{ env.secrets }}',
    '${{ env.Secrets }}',
    '${{ env . secrets }}',
    '${{ vars.secrets }}',
    '${{ vars.Secrets }}',
    '${{ mysecrets.VALUE }}',
    '${{ MySecrets.VALUE }}',
    '${{ secrets_manager.VALUE }}',
    '${{ SECRETS_MANAGER.VALUE }}',
    'normal string without a GitHub expression',
    "${{ contains('secrets', 'secret') }}",
    "${{ format('{{{0}}}', vars.FOO) }}",
    "${{ 'secrets.FOO' }}",
    "${{ 'Secrets.FOO' }}",
    "${{ 'secrets' }}",
    "${{ 'SECRETS' }}",
    'ordinary Secrets documentation',
  ])('does not mistake non-context text for a secret reference: %s', value => {
    expect(hasSecretExpression({ name: value })).toBe(false);
  });

  test('detects job-level secrets inheritance without banning it globally', () => {
    expect(hasSecretExpression({ uses: './.github/workflows/eas-build.yml', secrets: 'inherit' })).toBe(true);
    expect(isPinnedExternalUse('./.github/workflows/eas-build.yml')).toBe(true);
  });

  test('scans multiple expression bodies without treating quoted braces as delimiters', () => {
    expect(githubExpressionBodies("before ${{ '}}' }} middle ${{ format('{{', vars.FOO) }} after"))
      .toEqual([" '}}' ", " format('{{', vars.FOO) "]);
  });

  test('fails closed on an unterminated expression that references secrets', () => {
    expect(hasSecretsContextReference('${{ format(\'unterminated\', secrets.FOO)')).toBe(true);
  });

  test.each([
    'github.event.pull_request.head.repo.fork == false',
    '${{ github.event.pull_request.head.repo.fork == false }}',
    ' github.event.pull_request.head.repo.fork==false ',
    '${{\n github.event.pull_request.head.repo.fork  ==  false\n}}',
  ])('accepts exact fork trust boundary %j', condition => {
    expect(hasExactForkTrustBoundary(condition)).toBe(true);
  });

  test.each([
    undefined,
    '',
    'always()',
    'github.event.pull_request.head.repo.fork == false || always()',
    'always() || github.event.pull_request.head.repo.fork == false',
    'github.event.pull_request.head.repo.fork == false && always()',
    '!github.event.pull_request.head.repo.fork == false',
    'prefix github.event.pull_request.head.repo.fork == false suffix',
    'github.event.pull_request.head.repo.fork != true',
    'someFunction(github.event.pull_request.head.repo.fork == false)',
  ])('rejects non-exact fork trust boundary %j', condition => {
    expect(hasExactForkTrustBoundary(condition)).toBe(false);
  });

  test.each([
    ['pull_request', 'pull_request'],
    [['push', 'pull_request'], 'pull_request'],
    [{ pull_request: null }, 'pull_request'],
    [{ pull_request: {} }, 'pull_request'],
    [{ pull_request: { branches: ['main'] } }, 'pull_request'],
    ['pull_request_target', 'pull_request_target'],
    [['push', 'pull_request_target'], 'pull_request_target'],
    [{ pull_request_target: null }, 'pull_request_target'],
    [{ pull_request_target: {} }, 'pull_request_target'],
    [{ pull_request_target: { branches: ['main'] } }, 'pull_request_target'],
  ])('detects workflow trigger %j', (on, triggerName) => {
    expect(hasWorkflowTrigger(on, triggerName as string)).toBe(true);
  });

  test.each([
    ['push', 'pull_request'],
    [['push', 'workflow_dispatch'], 'pull_request'],
    [{ push: null }, 'pull_request'],
    [null, 'pull_request'],
    [undefined, 'pull_request'],
  ])('does not invent workflow trigger for %j', (on, triggerName) => {
    expect(hasWorkflowTrigger(on, triggerName as string)).toBe(false);
  });

  test.each([
    [{ permissions: { contents: 'read' } }, {}, false],
    [{}, { permissions: { contents: 'read' } }, false],
    [{ permissions: 'write-all' }, { permissions: { contents: 'read' } }, false],
    [{ permissions: { contents: 'write' } }, { permissions: {} }, false],
    [{ permissions: 'read-all' }, {}, false],
    [{ permissions: {} }, {}, false],
    [{}, {}, true],
    [{ permissions: 'write-all' }, {}, true],
    [{ permissions: { issues: 'none', contents: 'read' } }, {}, false],
    [{ permissions: { contents: 'admin' } }, {}, true],
    [{ permissions: null }, {}, true],
    [{ permissions: ['read-all'] }, {}, true],
    [{ permissions: 'read' }, {}, true],
  ])('models effective permissions with job-level override: workflow=%j job=%j',
    (workflow, job, expected) => {
      expect(hasSensitiveEffectivePermissions(workflow, job, true)).toBe(expected);
    });

  test.each([
    [undefined, undefined],
    ['write-all', undefined],
    [{ contents: 'write' }, undefined],
  ])('pull_request_target requires a guard for implicit or writable permissions %j',
    (workflowPermissions, jobPermissions) => {
      const job: any = { runsOn: 'ubuntu-latest' };
      const workflow: any = { on: { pull_request_target: null }, jobs: { test: job } };
      if (workflowPermissions !== undefined) workflow.permissions = workflowPermissions;
      if (jobPermissions !== undefined) job.permissions = jobPermissions;
      expect(prTrustBoundaryFailures(workflow)).toEqual([job]);

      job.if = 'github.event.pull_request.head.repo.fork == false || always()';
      expect(prTrustBoundaryFailures(workflow)).toEqual([job]);
      job.if = 'github.event.pull_request.head.repo.fork == false';
      expect(prTrustBoundaryFailures(workflow)).toEqual([]);
    });

  test.each([
    [{ permissions: 'read-all' }, {}],
    [{ permissions: { contents: 'read' } }, {}],
    [{ permissions: {} }, {}],
    [{ permissions: 'write-all' }, { permissions: { contents: 'read' } }],
    [{}, { permissions: {} }],
  ])('pull_request_target accepts an explicit effective read-only baseline: workflow=%j job=%j',
    (workflowFields, jobFields) => {
      const job = { runsOn: 'ubuntu-latest', ...jobFields };
      expect(prTrustBoundaryFailures({
        on: { pull_request_target: null },
        ...workflowFields,
        jobs: { test: job },
      })).toEqual([]);
    });

  test('ordinary pull_request does not treat implicit token permissions alone as sensitive', () => {
    expect(prTrustBoundaryFailures({
      on: { pull_request: null },
      jobs: { test: { runsOn: 'ubuntu-latest' } },
    })).toEqual([]);
  });

  test('does not skip a null-valued PR trigger on a secret or writable job', () => {
    const workflow = {
      on: { pull_request: null },
      jobs: {
        secretJob: { runsOn: 'ubuntu-latest', env: { TOKEN: '${{ secrets.FOO }}' } },
        writeJob: { runsOn: 'ubuntu-latest', permissions: { contents: 'write' } },
      },
    };
    expect(prTrustBoundaryFailures(workflow)).toEqual([
      workflow.jobs.secretJob,
      workflow.jobs.writeJob,
    ]);
  });

  test.each(['pull_request', 'pull_request_target'])('%s inherits secret-bearing workflow env into jobs', trigger => {
    const job = { runsOn: 'ubuntu-latest' };
    expect(prTrustBoundaryFailures({
      on: { [trigger]: null },
      env: { TOKEN: '${{ secrets.FOO }}' },
      jobs: { test: job },
    })).toEqual([job]);
  });

  test('does not treat non-secret workflow env as sensitive', () => {
    expect(prTrustBoundaryFailures({
      on: { pull_request: null },
      env: { NODE_ENV: 'test' },
      jobs: { test: { runsOn: 'ubuntu-latest' } },
    })).toEqual([]);
  });

  test('does not apply the PR gate to non-PR workflows with secret workflow env', () => {
    expect(prTrustBoundaryFailures({
      on: { push: null },
      env: { TOKEN: '${{ secrets.FOO }}' },
      jobs: { test: { runsOn: 'ubuntu-latest' } },
    })).toEqual([]);
  });

  test('accepts the expected trust boundary with inherited workflow secret env', () => {
    expect(prTrustBoundaryFailures({
      on: { pull_request: null },
      env: { TOKEN: '${{ secrets.FOO }}' },
      jobs: {
        test: {
          runsOn: 'ubuntu-latest',
          if: 'github.event.pull_request.head.repo.fork == false',
        },
      },
    })).toEqual([]);
  });

  test.each(['pull_request', 'pull_request_target'])('%s computed-secret job requires the exact fork guard', trigger => {
    const job: { runsOn: string; env: { TOKEN: string }; if?: string } = {
      runsOn: 'ubuntu-latest',
      env: { TOKEN: '${{ secrets[matrix.secret_name] }}' },
    };
    const workflow = { on: { [trigger]: null }, jobs: { test: job } };
    expect(prTrustBoundaryFailures(workflow)).toEqual([job]);

    job.if = 'github.event.pull_request.head.repo.fork == false || always()';
    expect(prTrustBoundaryFailures(workflow)).toEqual([job]);

    job.if = '${{ github.event.pull_request.head.repo.fork == false }}';
    expect(prTrustBoundaryFailures(workflow)).toEqual([]);
  });

  test.each(['pull_request', 'pull_request_target'])('%s whole secrets context requires the exact fork guard', trigger => {
    const job: { runsOn: string; env: { ALL_SECRETS: string }; if?: string } = {
      runsOn: 'ubuntu-latest',
      env: { ALL_SECRETS: '${{ toJSON(secrets) }}' },
    };
    const workflow = { on: { [trigger]: null }, jobs: { test: job } };
    expect(prTrustBoundaryFailures(workflow)).toEqual([job]);

    job.if = 'github.event.pull_request.head.repo.fork == false';
    expect(prTrustBoundaryFailures(workflow)).toEqual([]);
  });

  test.each(['pull_request', 'pull_request_target'])('%s quote-aware expression requires the exact fork guard', trigger => {
    const job: { runsOn: string; env: { TOKEN: string }; if?: string } = {
      runsOn: 'ubuntu-latest',
      env: { TOKEN: "${{ format('{{{0}}}', secrets.FOO) }}" },
    };
    const workflow = { on: { [trigger]: null }, jobs: { test: job } };
    expect(prTrustBoundaryFailures(workflow)).toEqual([job]);

    job.if = 'github.event.pull_request.head.repo.fork == false';
    expect(prTrustBoundaryFailures(workflow)).toEqual([]);
  });

  test('detects a secret after a harmless expression and quoted closing braces', () => {
    const job = {
      runsOn: 'ubuntu-latest',
      env: { TOKEN: "prefix ${{ vars.SAFE }} middle ${{ format('}}', secrets.FOO) }}" },
    };
    expect(prTrustBoundaryFailures({
      on: { pull_request: null },
      jobs: { test: job },
    })).toEqual([job]);
  });

  test('does not classify ordinary workflow text mentioning secrets as sensitive', () => {
    expect(prTrustBoundaryFailures({
      on: { pull_request: null },
      env: { MESSAGE: 'do not print secrets' },
      jobs: { test: { runsOn: 'ubuntu-latest', name: 'Validate secrets documentation' } },
    })).toEqual([]);
  });

  test('treats secrets used inside a local composite action as PR-sensitive', () => {
    const job: { runsOn: string; steps: { uses: string }[]; if?: string } = {
      runsOn: 'ubuntu-latest',
      steps: [{ uses: './action-a' }],
    };
    const workflow = { on: { pull_request: null }, jobs: { test: job } };
    const files = {
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - shell: bash\n      env:\n        TOKEN: ${{ secrets.FOO }}\n      run: printf \'%s\\n\' "$TOKEN"\n',
    };
    expect(checkWorkflowFixtureTrustBoundary(files, workflow)).toEqual([job]);

    job.if = 'github.event.pull_request.head.repo.fork == false';
    expect(checkWorkflowFixtureTrustBoundary(files, workflow)).toEqual([]);
  });

  test('combines pull_request_target defaults with mixed-case secrets in a local action', () => {
    const job: { runsOn: string; steps: { uses: string }[]; if?: string } = {
      runsOn: 'ubuntu-latest',
      steps: [{ uses: './action-a' }],
    };
    const workflow = { on: { pull_request_target: null }, jobs: { test: job } };
    const files = {
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - shell: bash\n      env:\n        TOKEN: ${{ Secrets.FOO }}\n      run: printf \'%s\\n\' "$TOKEN"\n',
    };
    expect(checkWorkflowFixtureTrustBoundary(files, workflow)).toEqual([job]);
    job.if = 'github.event.pull_request.head.repo.fork == false';
    expect(checkWorkflowFixtureTrustBoundary(files, workflow)).toEqual([]);
  });

  test.each(workflowFiles)('%s disables persisted checkout credentials across its local action chain', file => {
    expect(checkoutCredentialFailures(workflowSteps(load(file)), process.cwd())).toEqual([]);
  });

  test.each(actionManifestFiles)('%s standalone local action disables persisted checkout credentials', manifest => {
    expect(manifestCheckoutCredentialFailures(manifest, process.cwd())).toEqual([]);
  });

  test.each([
    { step: { uses: `actions/checkout@${'a'.repeat(40)}` } },
    { step: { uses: `actions/checkout@${'a'.repeat(40)}`, with: { 'persist-credentials': true } } },
    { step: { uses: `Actions/Checkout@${'a'.repeat(40)}` } },
  ])('rejects direct checkout without an explicit false persist-credentials value', ({ step }) => {
    expect(checkoutCredentialFailures([step], process.cwd())).toHaveLength(1);
  });

  test('rejects checkout without persist-credentials in a local composite action', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': `runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@${'a'.repeat(40)}\n`,
    }, checkoutCredentialFailures)).toHaveLength(1);
  });

  test('rejects checkout without persist-credentials in a nested local composite action', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yaml': `runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@${'a'.repeat(40)}\n`,
    }, checkoutCredentialFailures)).toHaveLength(1);
  });

  test('accepts checkout with persist-credentials disabled in a nested local composite action', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yaml': `runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@${'a'.repeat(40)}\n      with:\n        persist-credentials: false\n`,
    }, checkoutCredentialFailures)).toEqual([]);
  });

  test.each(workflowFiles)('%s keeps secret-bearing and writable jobs off pull requests', file => {
    const workflow = load(file);
    expect(prTrustBoundaryFailures(workflow)).toEqual([]);
  });
});

describe('workflow shell expression boundary', () => {
  test.each(workflowFiles)('%s has no GitHub expression in any reachable run script', file => {
    expect(runExpressionFailures(workflowSteps(load(file)), process.cwd())).toEqual([]);
  });

  test.each(actionManifestFiles)('%s standalone local action has no expression in a run script', manifest => {
    expect(manifestRunExpressionFailures(manifest, process.cwd())).toEqual([]);
  });

  test('rejects a direct workflow run expression', () => {
    expect(runExpressionFailures([{ run: 'echo "${{ inputs.ref }}"' }], process.cwd())).toHaveLength(1);
  });

  test('rejects a run expression in a local composite action', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo "${{ inputs.ref }}"\n',
    }, runExpressionFailures)).toHaveLength(1);
  });

  test('rejects a run expression in a nested local composite action', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - uses: ./action-b\n',
      'action-b/action.yaml': 'runs:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo "${{ inputs.ref }}"\n',
    }, runExpressionFailures)).toHaveLength(1);
  });

  test('accepts expression transfer through env when run uses only the shell variable', () => {
    expect(checkActionFixturePolicy({
      'action-a/action.yml': 'runs:\n  using: composite\n  steps:\n    - shell: bash\n      env:\n        REF: ${{ inputs.ref }}\n      run: printf \'%s\\n\' "$REF"\n',
    }, runExpressionFailures)).toEqual([]);
  });

  test.each([
    '"; id; #', '$(id)', '`id`', 'line\nfeed', 'carriage\rreturn', '-leading', '--help', '../', '@{1}',
    'refs/heads/test;echo injected', "single'quote", 'double"quote', '\\', '$HOME', '|', '>', '&', 'x'.repeat(4096),
  ])('shell variables preserve hostile ref data without a second evaluation: %j', value => {
    const result = spawnSync('bash', ['-c', 'printf %s "$UNTRUSTED"'], {env: {...process.env, UNTRUSTED: value}, encoding: 'utf8'});
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(value);
  });

  test('mutation back to direct interpolation is detected at the concrete step', () => {
    const workflow = load('eas-build.yml');
    const step = runBlocks(workflow).find((candidate) => candidate.name === 'Run EAS Build (WAIT)');
    const mutated = {...step, run: `${step.run}\necho "${'${{ inputs.ref }}'}"`};
    expect(mutated.run).toContain('${{ inputs.ref }}');
    expect(step.env).toEqual(expect.objectContaining({GH_PROFILE_8777ED: '${{ inputs.profile }}'}));
  });
});

describe('trusted build ref authorization', () => {
  const triggered = source('k1w1-triggered-build.yml');
  const workflow = load('k1w1-triggered-build.yml');
  const resolveStep = runBlocks(workflow).find((step) => step.name === 'Resolve inputs and enforce trusted commit ancestry');

  test('checks out only trusted workflow source before resolving external input', () => {
    const steps = workflow.jobs.resolve.steps;
    expect(steps[0]).toMatchObject({name: 'Checkout trusted workflow source'});
    expect(steps[0].with).toMatchObject({'fetch-depth': 0, 'persist-credentials': false});
  });

  test('accepts only codex, main, or a full commit SHA', () => {
    expect(resolveStep.run).toContain('"$REF" != "codex"');
    expect(resolveStep.run).toContain('"$REF" != "main"');
    expect(resolveStep.run).toContain('^[0-9a-fA-F]{40}$');
    expect(resolveStep.run).not.toContain('{7,40}');
  });

  test('resolves against fetched trusted branch history and passes a verified SHA', () => {
    expect(resolveStep.run).toContain('refs/remotes/origin/codex');
    expect(resolveStep.run).toContain('refs/remotes/origin/main');
    expect(resolveStep.run).toContain('git cat-file -e "${REF}^{commit}"');
    expect(resolveStep.run).toContain("printf 'ref=%s\\n' \"$OUTPUT_REF\"");
    expect(workflow.jobs.build.with.ref).toBe('${{ needs.resolve.outputs.ref }}');
  });

  test('enforces profile-specific ancestry and exact main for production', () => {
    expect(resolveStep.run).toContain('Development builds must use a commit reachable from codex.');
    expect(resolveStep.run).toContain('Preview builds must use a commit reachable from codex or main.');
    expect(resolveStep.run).toContain('Production builds must use the exact current main head.');
    expect(resolveStep.run).toContain('[ "$RESOLVED_SHA" != "$MAIN_SHA" ]');
  });

  test('allows writeback only for an explicit development build of codex', () => {
    expect(resolveStep.run).toContain('[ "$PROFILE" != "development" ] || [ "$REF" != "codex" ]');
    expect(resolveStep.run).toContain('Autofix is allowed only for an explicit development build of codex.');
  });

  test('does not pass the raw dispatch ref directly into the reusable secret workflow', () => {
    const buildBlock = triggered.slice(triggered.indexOf('\n  build:'));
    expect(buildBlock).not.toContain('github.event.client_payload.ref');
    expect(buildBlock).not.toContain('github.event.inputs.ref');
    expect(buildBlock).toContain('ref: ${{ needs.resolve.outputs.ref }}');
  });
});

describe('manual secret workflow trust boundaries', () => {
  test('EAS Build is reusable-only and cannot be manually dispatched around the trusted resolver', () => {
    const workflowSource = source('eas-build.yml');
    expect(workflowSource).toContain('  workflow_call:');
    expect(workflowSource).not.toContain('  workflow_dispatch:');
  });

  test('reusable EAS Build re-verifies its ref before any secret-bearing job', () => {
    const workflow = load('eas-build.yml');
    expect(workflow.jobs.autofix.needs).toBe('authorize');
    expect(workflow.jobs.build.needs).toEqual(['authorize', 'autofix']);
    const trustedCheckout = workflow.jobs.authorize.steps[0];
    expect(trustedCheckout.with).toMatchObject({ref: 'codex', 'fetch-depth': 0, 'persist-credentials': false});
    const resolveStep = runBlocks(workflow).find((step) => step.name === 'Verify trusted reusable ref');
    expect(resolveStep.run).toContain('Reusable non-autofix builds require a verified full 40-character SHA.');
    expect(resolveStep.run).toContain('Reusable autofix requires the explicit codex development ref.');
    const autofixCheckout = workflow.jobs.autofix.steps.find((step: any) => step.name === 'Checkout');
    const buildCheckout = workflow.jobs.build.steps.find((step: any) => step.name === 'Checkout');
    expect(autofixCheckout.with.ref).toBe('${{ needs.authorize.outputs.ref }}');
    expect(buildCheckout.with.ref).toBe('${{ needs.authorize.outputs.ref }}');
  });

  test('release build resolves the raw ref before the secret-bearing build job', () => {
    const workflow = load('release-build.yml');
    const resolveSteps = workflow.jobs.resolve.steps;
    expect(resolveSteps[0]).toMatchObject({
      name: 'Checkout trusted workflow source',
      with: expect.objectContaining({ref: 'codex', 'fetch-depth': 0, 'persist-credentials': false}),
    });
    const resolveStep = runBlocks(workflow).find((step) => step.name === 'Resolve release ref against trusted history');
    expect(resolveStep.run).toContain('^[0-9a-fA-F]{40}$');
    expect(resolveStep.run).toContain('Production builds must use the exact current main head.');
    expect(workflow.jobs.build.needs).toBe('resolve');
    const checkout = workflow.jobs.build.steps.find((step: any) => step.name === 'Checkout repository');
    expect(checkout.with.ref).toBe('${{ needs.resolve.outputs.ref }}');
    expect(checkout.with['persist-credentials']).toBe(false);
  });

  test('EAS Link resolves against codex/main before checkout and npm lifecycle execution', () => {
    const workflow = load('eas-link.yml');
    expect(workflow.jobs.link.needs).toBe('resolve');
    const trustedCheckout = workflow.jobs.resolve.steps[0];
    expect(trustedCheckout.with).toMatchObject({ref: 'codex', 'persist-credentials': false});
    const targetCheckout = workflow.jobs.link.steps.find((step: any) => step.name === 'Checkout');
    expect(targetCheckout.with.ref).toBe('${{ needs.resolve.outputs.ref }}');
    expect(targetCheckout.with['persist-credentials']).toBe(false);
    const resolveStep = runBlocks(workflow).find((step) => step.name === 'Resolve link ref against trusted history');
    expect(resolveStep.run).toContain('EAS link must target a commit reachable from codex or main.');
  });

  test.each([
    ['android-emulator-smoke.yml', 'development-apk-smoke', 'Checkout trusted codex head'],
    ['deploy-supabase-functions.yml', 'run-eas-build', 'Checkout trusted codex head'],
  ])('%s exposes manual secrets only on codex and never persists checkout credentials', (file, jobName, checkoutName) => {
    const workflow = load(file);
    const job = workflow.jobs[jobName];
    expect(String(job.if)).toContain("github.ref == 'refs/heads/codex'");
    const checkout = job.steps.find((step: any) => step.name === checkoutName);
    expect(checkout.with).toMatchObject({ref: 'codex', 'persist-credentials': false});
  });

  test('writable CI-lite autofix restricts target branches before checkout and drops checkout credentials', () => {
    const workflow = load('k1w1-ci-lite-autofix.yml');
    const determine = runBlocks(workflow).find((step) => step.name === 'Determine target branch');
    expect(determine.run).toContain('^(work|codex|dev|develop)$');
    const checkout = workflow.jobs.autofix.steps.find((step: any) => step.name === 'Checkout');
    expect(checkout.with['persist-credentials']).toBe(false);
  });
});

describe('CI check-status fallback', () => {
  test('push checks cover connector-created hardening and review branch families', () => {
    const workflow = load('ci.yml');
    const branches = workflow.on.push.branches;
    expect(branches).toEqual(expect.arrayContaining(['main', 'codex', 'fix/**', 'refactor/**', 'review/**']));
  });
});

describe('canonical job id data flow', () => {
  const valid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const acceptsOptionalJobId = (value: string) => value === '' || valid.test(value);
  test('allows an empty optional job ID before status updates are disabled', () => expect(acceptsOptionalJobId('')).toBe(true));
  test.each(['550e8400-e29b-41d4-a716-446655440000', '550E8400-E29B-41D4-A716-446655440000'])('accepts canonical UUID %s', value => expect(valid.test(value)).toBe(true));
  test.each([' x550e8400-e29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440000 ','550e8400%2De29b-41d4-a716-446655440000','550e8400-e29b-41d4-a716-446655440000,or','550e8400-e29b-41d4-a716-446655440000\n','$(id)',''])('rejects noncanonical network ID %j', value => expect(valid.test(value)).toBe(false));
  test('all Supabase filters use only VALIDATED_JOB_ID', () => {
    for (const file of ['eas-build.yml', 'deploy-supabase-functions.yml']) {
      const workflowSource = source(file);
      for (const filter of workflowSource.matchAll(/build_jobs\?id=eq\.\$\{([^}]+)\}/g)) expect(filter[1]).toBe('VALIDATED_JOB_ID');
    }
  });
});

describe('keystore diagnostic allowlist', () => {
  const helper = path.join(process.cwd(), 'scripts/ci/summarizeKeystoreResponse.cjs');
  const canaries = ['tiny-secret', 'A'.repeat(80), 'url_safe-token', 'https://x.test/a?token=CANARY', 'Bearer CANARY'];
  test.each([
    JSON.stringify({ok:false,password:canaries[0],nested:{token:canaries[1]},items:canaries}),
    `<html>${canaries.join(' ')}</html>`,
    `{broken ${canaries.join(' ')}`,
  ])('never copies response content into diagnostics', raw => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), '.keystore-test-'));
    const input = path.join(dir, 'raw'); const output = path.join(dir, 'summary.json');
    fs.writeFileSync(input, raw);
    spawnSync(process.execPath, [helper,input,output,'500'], {encoding:'utf8'});
    const summary = fs.readFileSync(output,'utf8');
    for (const canary of canaries) expect(summary).not.toContain(canary);
    expect(Object.keys(JSON.parse(summary))).toEqual(['httpStatus','responseBytes','jsonValid','contentClass','errorClass','expectedStructure','hasKeystoreBase64','hasKeystorePassword','hasAlias','hasKeyPassword','safeTopLevelKeys']);
    fs.rmSync(dir,{recursive:true,force:true});
  });
});
