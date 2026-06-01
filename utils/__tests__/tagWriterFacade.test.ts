import * as tagWriter from '../tagWriter';

const removedCompatibilityExports = [
  'writeTagsDryRun',
  'writeTagsToFileDryRun',
  'createTagWriterDryRunPlan',
  'applyTagEditsToBuffer',
] as const;

describe('tagWriter public facade', () => {
  it('keeps the productive facade exports available', () => {
    expect(tagWriter.TagWriterError).toBeDefined();
    expect(tagWriter.applyTagEditToBuffer).toBeDefined();
    expect(tagWriter.writeTagsToFile).toBeDefined();
    expect(tagWriter.prepareTagEditPlan).toBeDefined();
    expect(tagWriter.buildTagWritePayload).toBeDefined();
    expect(tagWriter.resolveWritableTagUri).toBeDefined();
    expect(tagWriter.ensureTagEditWriteAllowed).toBeDefined();
    expect(tagWriter.DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES).toBeGreaterThan(0);
  });

  it('does not reintroduce removed compatibility exports', () => {
    for (const exportName of removedCompatibilityExports) {
      expect(tagWriter).not.toHaveProperty(exportName);
    }
  });

  it('does not expose visualizer or fft fields from the tag writer facade', () => {
    const exportNames = Object.keys(tagWriter).map(name => name.toLowerCase());
    expect(exportNames.some(name => name.includes('visualizer'))).toBe(false);
    expect(exportNames.some(name => name.includes('fft'))).toBe(false);
  });
});
