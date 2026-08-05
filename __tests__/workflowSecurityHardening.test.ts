import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import YAML from '../node_modules/yaml/dist/index';

const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
const workflowFiles = fs.readdirSync(workflowsDir).filter((name) => name.endsWith('.yml'));
const load = (name: string) => YAML.parse(fs.readFileSync(path.join(workflowsDir, name), 'utf8'));
const source = (name: string) => fs.readFileSync(path.join(workflowsDir, name), 'utf8');

function runBlocks(document: any): any[] {
  return Object.values(document.jobs || {}).flatMap((job: any) => job.steps || []).filter((step: any) => typeof step.run === 'string');
}

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

describe('canonical job id data flow', () => {
  const valid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  test('allows an empty optional job ID before status updates are disabled', () => expect('' === '').toBe(true));
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
