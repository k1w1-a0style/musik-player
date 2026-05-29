import fs from 'fs';
import path from 'path';

const moduleSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'modules',
    'expo-system-audio',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'systemaudio',
    'SystemAudioModule.kt',
  ),
  'utf8',
);

describe('native visualizer release policy', () => {
  it('does not wire Android Visualizer or microphone permission APIs into the release module', () => {
    expect(moduleSource).not.toContain('import android.Manifest');
    expect(moduleSource).not.toContain('import android.media.audiofx.Visualizer');
    expect(moduleSource).not.toContain('import androidx.core.content.ContextCompat');
    expect(moduleSource).not.toContain('Manifest.permission.RECORD_AUDIO');
    expect(moduleSource).not.toContain('ContextCompat.checkSelfPermission');
    expect(moduleSource).not.toContain('Visualizer(0)');
  });

  it('keeps visualizerStart as an explicit disabled no-op', () => {
    expect(moduleSource).toContain('AsyncFunction("visualizerStart")');
    expect(moduleSource).toContain('"reason" to "disabled"');
    expect(moduleSource).toContain('false');
  });
});
