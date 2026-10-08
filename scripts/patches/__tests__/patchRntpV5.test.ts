import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';

interface Edit { from: string; to: string }
interface PatchEntry {
  path: string;
  upstreamSha256: string;
  patchedSha256: string;
  edits: Edit[];
}

const script = path.resolve(__dirname, '..', 'patchRntpV5.cjs');
const plan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'rntp-v5', 'patches.json'), 'utf8')) as PatchEntry[];
const installed = process.env.K1W1_RNTP_V5_SOURCE || path.resolve(__dirname, '..', '..', '..', 'node_modules', '@rntp', 'player');
const hash = (source: string): string => createHash('sha256').update(source).digest('hex');
const roots: string[] = [];

const createFixture = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rntp-v5-patch-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@rntp/player', version: '5.12.1' }));
  plan.forEach(entry => {
    let source = fs.readFileSync(path.join(installed, entry.path), 'utf8');
    if (hash(source) === entry.patchedSha256) {
      [...entry.edits].reverse().forEach(edit => { source = source.replace(edit.to, edit.from); });
    }
    if (hash(source) !== entry.upstreamSha256) throw new Error(`Fixture is not verified upstream: ${entry.path}`);
    const filename = path.join(root, entry.path);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, source);
  });
  return root;
};

const run = (root: string): string => execFileSync(process.execPath, [script, root], { encoding: 'utf8', stdio: 'pipe' });
const readSources = (root: string): string[] => plan.map(entry => fs.readFileSync(path.join(root, entry.path), 'utf8'));

afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));

describe('pinned RNTP V5 native acknowledgement patch', () => {
  test('patches verified upstream once and verifies the full patched checksum on reinstallation', () => {
    const root = createFixture();
    expect(run(root)).toContain('4 source files patched');
    const first = readSources(root);
    first.forEach((source, index) => expect(hash(source)).toBe(plan[index].patchedSha256));
    expect(run(root)).toContain('0 source files patched');
    expect(readSources(root)).toEqual(first);
    expect(fs.readFileSync(path.join(root, 'android', 'src', 'test', 'java', 'com', 'doublesymmetry', 'trackplayer', 'ControllerAcknowledgementTest.kt'), 'utf8'))
      .toContain('aNeverSettlingTransportKeepsFenceAndLaterWriterPending');
  });

  test('unsupported package version fails before any native source mutation', () => {
    const root = createFixture();
    const before = readSources(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@rntp/player', version: '5.13.0' }));
    expect(() => run(root)).toThrow();
    expect(readSources(root)).toEqual(before);
  });

  test('drift in the final upstream file leaves every earlier file untouched', () => {
    const root = createFixture();
    fs.appendFileSync(path.join(root, plan.at(-1)!.path), '\n// Unexpected upstream drift\n');
    const before = readSources(root);
    expect(() => run(root)).toThrow();
    expect(readSources(root)).toEqual(before);
  });

  test('a modified previously patched controller is rejected instead of silently accepted', () => {
    const root = createFixture();
    run(root);
    const controller = plan.find(entry => entry.path.endsWith('/MainThreadMediaController.kt'))!;
    fs.appendFileSync(path.join(root, controller.path), '\n// Unverified local edit\n');
    const before = readSources(root);
    expect(() => run(root)).toThrow();
    expect(readSources(root)).toEqual(before);
  });

  test('native patch covers service failures, future ordering, local session and buffering intent', () => {
    const root = createFixture();
    run(root);
    const controller = fs.readFileSync(path.join(root, plan[1].path), 'utf8');
    const module = fs.readFileSync(path.join(root, plan[2].path), 'utf8');
    const service = fs.readFileSync(path.join(root, plan[3].path), 'utf8');
    expect(controller).toContain('val result = command.block(mc)');
    expect(controller).toContain('check(code == SessionResult.RESULT_SUCCESS)');
    expect(controller).toContain('completionCommands.toList()');
    expect(controller).not.toContain('if (connection.ready && playerCommand)');
    expect(module).toContain('controller.enqueueResult("play")');
    expect(module).toContain('controller.enqueueResult("setCommands")');
    expect(module).toContain('if (mc.playerError != null) return@sync "error"');
    expect(module).toContain('require(metadata.getString("expectedMediaId") == existing.mediaId)');
    expect(service).toContain('currentPlaybackRoute() == PlaybackRoute.LOCAL');
    expect(service).toContain('audioSessionId?.takeIf { it > 0 }');
    expect(service).toContain('IsPlayingChangedEvent(activePlayer.isPlaying)');
  });
});
