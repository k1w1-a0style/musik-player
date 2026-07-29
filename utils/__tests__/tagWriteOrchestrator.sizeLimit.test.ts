import {
  assertSafeWriteAllowed,
  createTagWriteOperationPlan,
  DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
  simulateTagWriteOperation,
} from '../tagWriteOrchestrator';
import type { Song } from '../../types/Song';

const draft = { songId: 's1', tags: { title: 'New Title' } };

const songWithSize = (size: number): Song => ({
  id: 's1',
  title: 'Old Title',
  artist: 'Artist',
  uri: 'file:///music/song.mp3',
  fileInfo: {
    uri: 'file:///music/song.mp3',
    filename: 'song.mp3',
    extension: 'mp3',
    size,
  },
});

describe('tag write orchestrator size limit', () => {
  it('blocks oversized known file sizes before byte reads', () => {
    const plan = createTagWriteOperationPlan(
      songWithSize(DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES + 1),
      draft,
      'android',
    );

    expect(plan.blockingReasons).toContain('FileTooLarge');
    expect(assertSafeWriteAllowed(plan)).toBe('FileTooLarge');
    expect(plan.warnings.join(' ')).toContain('blocked before reading bytes');
  });

  it('allows files at the configured size limit', () => {
    const plan = createTagWriteOperationPlan(
      songWithSize(DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES),
      draft,
      'android',
    );

    expect(plan.blockingReasons).not.toContain('FileTooLarge');
  });

  it('surfaces FileTooLarge in dry run output', () => {
    const plan = createTagWriteOperationPlan(
      songWithSize(DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES + 1024),
      draft,
      'android',
    );
    const result = simulateTagWriteOperation(plan);

    expect(result.ok).toBe(false);
    expect(result.primaryBlockingReason).toBe('FileTooLarge');
    expect(result.blockingReasons).toContain('FileTooLarge');
  });

  it('does not let a caller widen the hard safety ceiling', () => {
    const plan = createTagWriteOperationPlan(
      songWithSize(DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES),
      draft,
      'android',
      DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES + 1,
    );

    expect(plan.blockingReasons).toContain('FileTooLarge');
    expect(assertSafeWriteAllowed(plan)).toBe('FileTooLarge');
  });

  it('rejects invalid custom limits', () => {
    const plan = createTagWriteOperationPlan(
      songWithSize(1),
      draft,
      'android',
      Number.NaN,
    );

    expect(plan.blockingReasons).toContain('InvalidTagData');
  });
});
