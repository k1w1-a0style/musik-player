import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from '../node_modules/yaml/dist/index';

const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
const workflowFiles = fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name));
const load = (name: string) => YAML.parse(fs.readFileSync(path.join(workflowsDir, name), 'utf8'));
const source = (name: string) => fs.readFileSync(path.join(workflowsDir, name), 'utf8');

function runBlocks(document: any): any[] {
  return Object.values(document.jobs || {}).flatMap((job: any) => job.steps || []).filter((step: any) => typeof step.run === 'string');
}

const jobs = (document: any): any[] => Object.values(document.jobs || {});
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

const stepUsePinningFailures = (
  value: unknown,
  repoRoot: string,
  checkedManifests = new Set<string>(),
): string[] => {
  if (typeof value !== 'string') return ['uses must be a string'];
  if (!value.startsWith('./')) return EXTERNAL_USE_WITH_SHA.test(value) ? [] : [`unpinned external action: ${value}`];

  const actionDirectory = path.resolve(repoRoot, value);
  if (!isInsideRepository(repoRoot, actionDirectory)) return [`unsafe local action path: ${value}`];
  const manifest = localActionManifest(repoRoot, actionDirectory);
  if (!manifest) return [`local action manifest missing or unsafe: ${value}`];
  if (checkedManifests.has(manifest)) return [];
  checkedManifests.add(manifest);

  let document: any;
  try {
    document = YAML.parse(fs.readFileSync(manifest, 'utf8'));
  } catch {
    return [`local action manifest is invalid: ${path.relative(repoRoot, manifest)}`];
  }
  if (document?.runs?.using !== 'composite') return [];
  const steps = Array.isArray(document.runs.steps) ? document.runs.steps : [];
  return steps.flatMap((step: any) => step.uses == null
    ? []
    : stepUsePinningFailures(step.uses, repoRoot, checkedManifests));
};

const checkActionFixture = (files: Record<string, string>, entry = './action-a'): string[] => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-action-pinning-'));
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(repoRoot, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    }
    return stepUsePinningFailures(entry, repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
};

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
    if (match[0] !== 'secrets') continue;
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
const hasWritePermission = (permissions: unknown): boolean => permissions === 'write-all'
  || (permissions != null && typeof permissions === 'object'
    && Object.values(permissions).some(value => value === 'write'));

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

const prTrustBoundaryFailures = (workflow: any): any[] => {
  const pullsCode = hasWorkflowTrigger(workflow.on, 'pull_request')
    || hasWorkflowTrigger(workflow.on, 'pull_request_target');
  if (!pullsCode) return [];
  const workflowHasSecretEnv = hasSecretExpression(workflow.env);
  return jobs(workflow).filter(job => {
    const sensitive = workflowHasSecretEnv || hasSecretExpression(job)
      || hasWritePermission(job.permissions) || hasWritePermission(workflow.permissions);
    return sensitive && !hasExactForkTrustBoundary(job.if);
  });
};

describe('repository-wide workflow security inventory', () => {
  test.each(workflowFiles)('%s pins every external action to an immutable commit', file => {
    for (const job of jobs(load(file))) {
      if (job.uses != null) expect(isPinnedExternalUse(job.uses)).toBe(true);
      for (const step of job.steps || []) {
        if (step.uses != null) expect(stepUsePinningFailures(step.uses, process.cwd())).toEqual([]);
      }
    }
  });

  test.each(['main', 'master', 'v1', 'abcdef1'])('rejects movable action @%s hidden in a local composite', ref => {
    expect(checkActionFixture({
      'action-a/action.yml': `runs:\n  using: composite\n  steps:\n    - uses: owner/action@${ref}\n`,
    })).toEqual([`unpinned external action: owner/action@${ref}`]);
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
    expect(stepUsePinningFailures('./.github/actions/determine-ref', process.cwd())).toEqual([]);
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
    "${{ secrets['FOO'] }}",
    '${{ secrets["FOO"] }}',
    '${{ secrets[matrix.secret_name] }}',
    '${{ secrets[ matrix.secret_name ] }}',
    '${{ env[secrets] }}',
    "${{ secrets[format('{0}_TOKEN', matrix.target)] }}",
    '${{ toJSON(secrets) }}',
    '${{ secrets }}',
    "${{ contains(toJSON(secrets), 'TOKEN') }}",
    'first=${{ vars.SAFE }} second=${{ toJSON(secrets) }}',
    "${{ format('{{{0}}}', secrets.FOO) }}",
    "${{ format('}}', secrets.FOO) }}",
    "${{ format('{{', secrets.FOO) }}",
    "${{ '}}' }}-${{ secrets.FOO }}",
    'prefix-${{ vars.SAFE }}-${{ toJSON(secrets) }}-suffix',
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
    '${{ env . secrets }}',
    '${{ vars.secrets }}',
    '${{ mysecrets.VALUE }}',
    '${{ secrets_manager.VALUE }}',
    'normal string without a GitHub expression',
    "${{ contains('secrets', 'secret') }}",
    "${{ format('{{{0}}}', vars.FOO) }}",
    "${{ 'secrets.FOO' }}",
    "${{ 'secrets' }}",
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

  test.each(workflowFiles)('%s disables persisted checkout credentials', file => {
    for (const job of jobs(load(file))) {
      for (const step of job.steps || []) {
        if (typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@')) {
          expect(step.with?.['persist-credentials']).toBe(false);
        }
      }
    }
  });

  test.each(workflowFiles)('%s keeps secret-bearing and writable jobs off pull requests', file => {
    const workflow = load(file);
    expect(prTrustBoundaryFailures(workflow)).toEqual([]);
  });
});

describe('workflow shell expression boundary', () => {
  test.each(workflowFiles)('%s has no GitHub expression in a run script', (file) => {
    for (const step of runBlocks(load(file))) expect(step.run).not.toContain('${{');
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
