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

  test('android file and confirmed SAF content mp3 are readable and writable', () => {
    const fileCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'android');
    const safContentCap = getTagEditCapability(song({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fa.mp3',
      fileInfo: { extension: 'mp3', source: 'saf' },
    }), 'android');
    const ambiguousTreeCap = getTagEditCapability(song({
      uri: 'content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fb.mp3',
      fileInfo: { extension: 'mp3' },
    }), 'android');
    const mediaContentCap = getTagEditCapability(song({ uri: 'content://media/a.mp3', fileInfo: { extension: 'mp3', source: 'media-library' } }), 'android');

    expect(fileCap.canRead).toBe(true);
    expect(fileCap.canWrite).toBe(true);
    expect(safContentCap.canRead).toBe(true);
    expect(safContentCap.canWrite).toBe(true);
    expect(ambiguousTreeCap.canRead).toBe(true);
    expect(ambiguousTreeCap.canWrite).toBe(false);
    expect(ambiguousTreeCap.reason).toMatch(/bestätigte SAF-Herkunft/i);
    expect(mediaContentCap.canRead).toBe(true);
    expect(mediaContentCap.canWrite).toBe(false);
  });

  test('infers supported container from URI, filename and mime type when extension is missing', () => {
    expect(isSupportedTagEditContainer(song({ uri: 'file:///music/a.mp3' }))).toBe(true);
    expect(isSupportedTagEditContainer(song({ fileInfo: { filename: 'Artist - Track.m4a' }, uri: 'file:///fallback' }))).toBe(true);
    expect(isSupportedTagEditContainer(song({ fileInfo: { mimeType: 'audio/mpeg' }, uri: 'content://media/1' }))).toBe(true);
  });

  test('platform-gated file capability (ios/web blocked)', () => {
    const iosCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'ios');
    const webCap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }), 'web');
    const androidMp4Cap = getTagEditCapability(song({ uri: 'file:///music/a.mp4', fileInfo: { extension: 'mp4' } }), 'android');
    const androidM4aCap = getTagEditCapability(song({ uri: 'file:///music/a.m4a', fileInfo: { extension: 'm4a' } }), 'android');
    expect(iosCap.canWrite).toBe(false);
    expect(webCap.canWrite).toBe(false);
    expect(iosCap.reason).toMatch(/Sicheres Ersetzen vorhandener Dateien wird auf dieser Plattform noch nicht unterstützt/i);
    expect(androidMp4Cap.canWrite).toBe(true);
    expect(androidM4aCap.canWrite).toBe(true);
    expect(isFileWriteSupportedOnPlatform('android')).toBe(true);
    expect(isFileWriteSupportedOnPlatform('ios')).toBe(false);
  });

  test('content:// m4a/mp4 require a SAF source signal on Android', () => {
    const mediaM4a = getTagEditCapability(song({ uri: 'content://media/a.m4a', fileInfo: { extension: 'm4a', source: 'media-library' } }), 'android');
    const mediaMp4 = getTagEditCapability(song({ uri: 'content://media/a.mp4', fileInfo: { extension: 'mp4', source: 'media-library' } }), 'android');
    const ambiguousM4a = getTagEditCapability(song({ uri: 'content://tree/a.m4a', fileInfo: { extension: 'm4a' } }), 'android');
    const safM4a = getTagEditCapability(song({ uri: 'content://tree/a.m4a', fileInfo: { extension: 'm4a', source: 'saf' } }), 'android');
    const safMp4 = getTagEditCapability(song({ uri: 'content://tree/a.mp4', fileInfo: { extension: 'mp4', source: 'saf' } }), 'android');

    expect(mediaM4a.canWrite).toBe(false);
    expect(mediaMp4.canWrite).toBe(false);
    expect(ambiguousM4a.canWrite).toBe(false);
    expect(mediaM4a.reason).toMatch(/bestätigte SAF-Herkunft/i);
    expect(safM4a.canWrite).toBe(true);
    expect(safMp4.canWrite).toBe(true);
    expect(safM4a.reason).toMatch(/MP3\/M4A\/MP4/i);
  });

  test('helpers', () => {
    expect(getUriType('file:///a')).toBe('file');
    expect(isSupportedTagEditContainer(song({ fileInfo: { extension: 'mp3' } }))).toBe(true);
  });
});
