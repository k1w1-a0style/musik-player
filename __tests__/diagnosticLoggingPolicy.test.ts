import fs from 'fs';
import path from 'path';

const indexSource = fs.readFileSync(path.join(process.cwd(), 'index.js'), 'utf8');
const sanitizerSource = fs.readFileSync(path.join(process.cwd(), 'utils', 'diagnosticSanitizer.ts'), 'utf8');

describe('diagnostic logging privacy policy', () => {
  test('installs the diagnostic console sanitizer before playback service and app registration', () => {
    const installAt = indexSource.indexOf('installDiagnosticConsoleSanitizer();');
    const playbackAt = indexSource.indexOf('TrackPlayer.registerPlaybackService');
    const appAt = indexSource.indexOf('registerRootComponent(App)');
    expect(installAt).toBeGreaterThanOrEqual(0);
    expect(playbackAt).toBeGreaterThan(installAt);
    expect(appAt).toBeGreaterThan(installAt);
  });

  test('covers every production console severity and sanitizes every argument', () => {
    for (const method of ['debug', 'info', 'log', 'warn', 'error']) {
      expect(sanitizerSource).toContain(`'${method}'`);
    }
    expect(sanitizerSource).toContain('original(...sanitizeDiagnosticArgs(args))');
  });

  test('keeps raw error stacks out of sanitized Error diagnostics', () => {
    expect(sanitizerSource).toContain('name: sanitizeDiagnosticText(error.name');
    expect(sanitizerSource).toContain('message: sanitizeDiagnosticText(error.message');
    expect(sanitizerSource).not.toContain('stack: error.stack');
  });
});
