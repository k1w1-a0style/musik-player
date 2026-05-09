import type { Song } from '../../types/Song';
import { getTagEditCapability, getUriType, isSupportedTagEditContainer } from '../tagEditCapability';

const song = (overrides: Partial<Song>): Song => ({ id: '1', title: 't', artist: 'a', ...overrides });

describe('tagEditCapability', () => {
  test('remote URL is not editable', () => {
    const cap = getTagEditCapability(song({ uri: 'https://example.com/demo.mp3', fileInfo: { extension: 'mp3' } }));
    expect(cap.canWrite).toBe(false);
    expect(cap.uriType).toBe('remote');
  });

  test('mp3 file URI is recognized as supported container', () => {
    const cap = getTagEditCapability(song({ uri: 'file:///music/a.mp3', fileInfo: { extension: 'mp3' } }));
    expect(cap.supportedContainer).toBe('mp3');
    expect(cap.uriType).toBe('file');
  });

  test('m4a/mp4 containers are prepared', () => {
    expect(getTagEditCapability(song({ uri: 'file:///x.m4a', fileInfo: { extension: 'm4a' } })).supportedContainer).toBe('m4a');
    expect(getTagEditCapability(song({ uri: 'file:///x.mp4', fileInfo: { extension: 'mp4' } })).supportedContainer).toBe('mp4');
  });

  test('unknown extension is unsupported', () => {
    const cap = getTagEditCapability(song({ uri: 'file:///x.flac', fileInfo: { extension: 'flac' } }));
    expect(cap.supportedContainer).toBe('unsupported');
  });

  test('content uri mp3 is cautious', () => {
    const cap = getTagEditCapability(song({ uri: 'content://music/1', fileInfo: { extension: 'mp3' } }));
    expect(cap.uriType).toBe('content');
    expect(cap.canWrite).toBe(false);
  });

  test('helpers', () => {
    expect(getUriType('file:///a')).toBe('file');
    expect(isSupportedTagEditContainer(song({ fileInfo: { extension: 'mp3' } }))).toBe(true);
  });
});
