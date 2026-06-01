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

  it('does not expose disabled visualizer bridge methods or events', () => {
    expect(moduleSource).not.toContain('AsyncFunction("visualizerStart")');
    expect(moduleSource).not.toContain('Function("visualizerStop")');
    expect(moduleSource).not.toContain('onFftData');
    expect(moduleSource).not.toContain('onVisualizerStateChanged');
  });
});
