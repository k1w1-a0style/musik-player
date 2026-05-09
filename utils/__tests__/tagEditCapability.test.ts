import type { Song } from '../../types/Song';
import { getTagEditCapability, getUriType, isSupportedTagEditContainer } from '../tagEditCapability';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 't', artist: 'a', ...overrides });

describe('tagEditCapability', () => {
  test('missing uri is not readable', () => {
    const cap = getTagEditCapability(song({ fileInfo: { extension: 'mp3' } }));
    expect(cap.canRead).toBe(false);
    expect(cap.canWrite).toBe(false);
  });

  test('unsupported with uri is readable but not writable', () => {
    const cap = getTagEditCapability(song({ uri: 'file:///x.flac', fileInfo: { extension: 'flac' } }));
    expect(cap.canRead).toBe(true);
    expect(cap.canWrite).toBe(false);
    expect(cap.supportedContainer).toBe('unsupported');
  });

  test('unsupported without uri is not readable', () => {
    const cap = getTagEditCapability(song({ fileInfo: { extension: 'flac' } }));
    expect(cap.canRead).toBe(false);
  });

  test('remote URL is not editable', () => {
    const cap = getTagEditCapability(song({ uri: 'https://example.com/demo.mp3', fileInfo: { extension: 'mp3' } }));
    expect(cap.canRead).toBe(true);
    expect(cap.canWrite).toBe(false);
    expect(cap.uriType).toBe('remote');
  });

  test('file/content mp3 are readable and guarded write=false', () => {
    expect(getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } })).canRead).toBe(true);
    expect(getTagEditCapability(song({ uri: 'content://music/1', fileInfo: { extension: 'mp3' } })).canRead).toBe(true);
  });

  test('helpers', () => {
    expect(getUriType('file:///a')).toBe('file');
    expect(isSupportedTagEditContainer(song({ fileInfo: { extension: 'mp3' } }))).toBe(true);
  });
});
