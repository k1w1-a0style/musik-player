import { renderHook } from '@testing-library/react-native';
import type { Song } from '../../types/Song';
import { useTagEditorCapability } from '../useTagEditorCapability';

const localSong: Song = {
  id: 'local-editor-song',
  title: 'Local',
  artist: 'Artist',
  uri: 'file:///music/local.mp3',
  cover: 'file:///music/local.jpg',
  fileInfo: { extension: 'mp3' },
};

describe('useTagEditorCapability local file safety', () => {
  test('keeps local files readable and cover-selectable but disables every write action', () => {
    const { result } = renderHook(() => useTagEditorCapability({
      song: localSong,
      draft: { songId: localSong.id, tags: { title: 'Changed' } },
      hasChanges: true,
      saving: false,
    }));

    expect(result.current.capability.canRead).toBe(true);
    expect(result.current.plan.permission.canWrite).toBe(false);
    expect(result.current.plan.blockingReasons).toContain('WriteNotImplemented');
    expect(result.current.canSave).toBe(false);
    expect(result.current.canPickCover).toBe(true);
    expect(result.current.canWriteCover).toBe(false);
    expect(result.current.capabilityMessage).toMatch(/persistent crash-recovery journal/i);
    expect(result.current.coverCapabilityMessage).toMatch(/noch nicht gespeichert/i);
  });
});
