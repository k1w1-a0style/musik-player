import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const script = path.resolve(__dirname, '..', 'patchReactNativeTrackPlayer.cjs');

describe('patchReactNativeTrackPlayer', () => {
  test('fails closed for an unverified RNTP version', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rntp-patch-'));
    const packageDir = path.join(root, 'node_modules', 'react-native-track-player');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ version: '4.2.0' }));

    expect(() => execFileSync(process.execPath, [script], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    })).toThrow();
  });

  test('patches the pinned module idempotently with a player audio-session bridge', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rntp-patch-valid-'));
    const packageDir = path.join(root, 'node_modules', 'react-native-track-player');
    const moduleDir = path.join(packageDir, 'android', 'src', 'main', 'java', 'com', 'doublesymmetry', 'trackplayer', 'module');
    const serviceDir = path.join(packageDir, 'android', 'src', 'main', 'java', 'com', 'doublesymmetry', 'trackplayer', 'service');
    fs.mkdirSync(moduleDir, { recursive: true });
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ version: '4.1.2' }));
    fs.writeFileSync(path.join(moduleDir, 'MusicModule.kt'), `
import android.os.Build
Arguments.fromBundle(musicService.tracks[index].originalItem)
musicService.tracks[musicService.getCurrentTrackIndex()].originalItem
    @ReactMethod
    fun setRate(rate: Float, callback: Promise) = scope.launch {
    }
`);
    fs.writeFileSync(path.join(serviceDir, 'MusicService.kt'), `
import com.google.android.exoplayer2.ui.R as ExoPlayerR
    @MainThread
    fun getRate(): Float = player.playbackSpeed
`);

    for (let run = 0; run < 2; run += 1) {
      execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    }

    const moduleContent = fs.readFileSync(path.join(moduleDir, 'MusicModule.kt'), 'utf8');
    const serviceContent = fs.readFileSync(path.join(serviceDir, 'MusicService.kt'), 'utf8');
    expect(moduleContent.match(/fun getAudioSessionId\(/g)).toHaveLength(1);
    expect(moduleContent).toContain('callback.resolve(musicService.getAudioSessionId())');
    expect(serviceContent.match(/fun getAudioSessionId\(/g)).toHaveLength(1);
    expect(serviceContent).toContain('ExoPlayer::class.java.isAssignableFrom(it.type)');
    expect(serviceContent).toContain('audioSessionId?.takeIf { it > 0 }');
  });

});
