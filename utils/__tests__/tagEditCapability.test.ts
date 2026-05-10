import type { Song } from '../../types/Song';
import { getTagEditCapability, getUriType, isFileWriteSupportedOnPlatform, isSupportedTagEditContainer } from '../tagEditCapability';

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

  test('android file/content mp3 are readable and only file is writable', () => {
    const fileCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'android');
    const contentCap = getTagEditCapability(song({ uri: 'content://music/1', fileInfo: { extension: 'mp3' } }));
    expect(fileCap.canRead).toBe(true);
    expect(fileCap.canWrite).toBe(true);
    expect(contentCap.canRead).toBe(true);
    expect(contentCap.canWrite).toBe(false);
  });

  test('platform-gated file capability (ios/web blocked)', () => {
    const iosCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'ios');
    const webCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'web');
    const androidMp4Cap = getTagEditCapability(song({ uri: 'file:///music/a.mp4', fileInfo: { extension: 'mp4' } }), 'android');
    const androidM4aCap = getTagEditCapability(song({ uri: 'file:///music/a.m4a', fileInfo: { extension: 'm4a' } }), 'android');
    expect(iosCap.canWrite).toBe(false);
    expect(webCap.canWrite).toBe(false);
    expect(iosCap.reason).toMatch(/Safe existing file replacement is not supported/i);
    expect(androidMp4Cap.canWrite).toBe(true);
    expect(androidM4aCap.canWrite).toBe(true);
    expect(isFileWriteSupportedOnPlatform('android')).toBe(true);
    expect(isFileWriteSupportedOnPlatform('ios')).toBe(false);
  });



  test('content:// m4a/mp4 stay read-only', () => {
    const m4a = getTagEditCapability(song({ uri: 'content://music/a.m4a', fileInfo: { extension: 'm4a' } }));
    const mp4 = getTagEditCapability(song({ uri: 'content://music/a.mp4', fileInfo: { extension: 'mp4' } }));
    expect(m4a.canWrite).toBe(false);
    expect(mp4.canWrite).toBe(false);
    expect(m4a.reason).toMatch(/SAF\/content:\/\//i);
  });

  test('helpers', () => {
    expect(getUriType('file:///a')).toBe('file');
    expect(isSupportedTagEditContainer(song({ fileInfo: { extension: 'mp3' } }))).toBe(true);
  });
});