import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import YAML from '../node_modules/yaml/dist/index';

const root = path.join(__dirname, '..');
const steps = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/k1w1-ci-lite-autofix.yml'), 'utf8')).jobs.autofix.steps;
const step = (id: string) => steps.find((item: any) => item.id === id);
const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();

const fixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'autofix-gate-'));
  const bin = path.join(directory, 'bin'); fs.mkdirSync(bin);
  const script = (name: string, content: string) => fs.writeFileSync(path.join(bin, name), `#!/bin/bash\n${content}\n`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, REAL_GIT: realGit, REAL_NODE: process.execPath,
    TARGET_BRANCH: 'codex', ALLOWED_REF_REGEX: '^(work|codex|dev|develop)$',
    GITHUB_OUTPUT: path.join(directory, 'outputs'), GITHUB_ENV: path.join(directory, 'env'),
    GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'baseline', WORKFLOW_VERSION: '400',
    JOB_ID: '', GH_PACKAGE_MANAGER_9162DF: 'npm', GH_ESLINT_FIX_EXIT_DEA00F: '0', GH_CHANGED_CD4261: 'false', GH_PUSHED_691437: 'false',
    AUTOFIX_VERIFY_OUTCOME: 'success', AUTOFIX_FIX_EXIT: '0', GH_TOKEN: 'test-only-placeholder' };
  script('npm', 'if [[ "$*" == *"${FAIL_GATE:-never-match}"* ]]; then exit 1; fi\nexit 0');
  script('npx', 'if [[ "$*" == *"expo config"* ]]; then printf \'{"extra":{"eas":{"projectId":"test-project"}}}\\n\'; fi\nexit 0');
  script('node', 'if [[ "$1" == scripts/* ]]; then exit 0; fi\nexec "$REAL_NODE" "$@"');
  script('git', 'printf "%s\\n" "$*" >> git-calls.log\nif [[ "$1" == ls-remote ]]; then printf "baseline\\trefs/heads/codex\\n"; exit 0; fi\nif [[ "$*" == *"push origin"* ]]; then touch pushed; exit 0; fi\nexec "$REAL_GIT" "$@"');
  const git = (...args: string[]) => {
    const result = spawnSync(realGit, args, { cwd: directory, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout;
  };
  git('init', '-b', 'codex'); git('config', 'user.email', 'fixture@example.test'); git('config', 'user.name', 'Fixture');
  fs.mkdirSync(path.join(directory, 'src')); fs.writeFileSync(path.join(directory, 'src/song.ts'), 'export const count = 1;\n');
  git('add', 'src/song.ts'); git('commit', '-m', 'baseline');
  fs.writeFileSync(path.join(directory, 'src/song.ts'), 'export const count = 2;\n');
  fs.writeFileSync(path.join(directory, 'untracked-result.log'), 'must never be published\n');
  return { directory, env, git, run: (source: string, extra: Record<string, string> = {}) =>
    spawnSync('/bin/bash', ['-c', source], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8' }),
  dispose: () => fs.rmSync(directory, { recursive: true, force: true }) };
};

test('autofix verifies changes before attempting writeback', () => {
  expect(steps.indexOf(step('fix'))).toBeLessThan(steps.indexOf(step('verify')));
  expect(steps.indexOf(step('verify'))).toBeLessThan(steps.indexOf(step('writeback')));
});
test.each(['lint:ci', 'typecheck', 'test:coverage', 'check:complexity'])('a failing %s gate rejects the candidate', gate => {
  const test = fixture();
  try {
    const result = test.run(step('verify').run, { FAIL_GATE: gate });
    expect(result.status).not.toBe(0);
    expect(fs.existsSync(path.join(test.directory, 'pushed'))).toBe(false);
  } finally { test.dispose(); }
});
test.each([['AUTOFIX_VERIFY_OUTCOME', 'failure'], ['AUTOFIX_FIX_EXIT', '1']] as const)('writeback itself rejects unsuccessful %s', (key, value) => {
  const test = fixture();
  try {
    expect(test.run(step('writeback').run, { [key]: value }).status).not.toBe(0);
    expect(fs.existsSync(path.join(test.directory, 'pushed'))).toBe(false);
    expect(test.git('log', '--format=%s')).toBe('baseline\n');
  } finally { test.dispose(); }
});
test('verified writeback publishes only tracked source changes and keeps ordinary CI enabled', () => {
  const test = fixture();
  try {
    const result = test.run(step('writeback').run);
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(test.directory, 'pushed'))).toBe(true);
    expect(test.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).toBe('src/song.ts\n');
    expect(test.git('log', '-1', '--format=%s')).not.toContain('[skip ci]');
  } finally { test.dispose(); }
});
test('writeback rejects a candidate with unstaged dependency or documentation changes', () => {
  const test = fixture();
  try {
    fs.writeFileSync(path.join(test.directory, 'package.json'), '{"dependencies":{}}\n');
    test.git('add', 'package.json'); test.git('commit', '-m', 'package baseline');
    fs.writeFileSync(path.join(test.directory, 'package.json'), '{"dependencies":{"unexpected":"*"}}\n');
    expect(test.run(step('writeback').run).status).not.toBe(0);
    expect(fs.existsSync(path.join(test.directory, 'pushed'))).toBe(false);
    expect(test.git('log', '-1', '--format=%s')).toBe('package baseline\n');
  } finally { test.dispose(); }
});
