import type { Song } from '../types/Song';
import type { EditableTrackTags, TagEditDraft, TagEditPlan, TagEditableContainer, TagWriterErrorCode } from '../types/TagEdit';
import { getTagEditCapability, getUriType, getSupportedContainer } from './tagEditCapability';
import { normalizeEditableTags, validateCoverPayload, validateEditableTags } from './tagValidation';

export class TagWriterError extends Error {
  constructor(public code: TagWriterErrorCode, message: string) {
    super(message);
    this.name = 'TagWriterError';
  }
}

const ID3_TEXT_FRAME_IDS = ['TIT2', 'TPE1', 'TALB', 'TDRC', 'TCON', 'TRCK', 'TPOS'] as const;
type Id3TextFrameId = (typeof ID3_TEXT_FRAME_IDS)[number];

export const ID3_TEXT_FRAME_MAP: Partial<Record<keyof EditableTrackTags, Id3TextFrameId>> = {
  title: 'TIT2',
  artist: 'TPE1',
  album: 'TALB',
  year: 'TDRC',
  genre: 'TCON',
  trackNumber: 'TRCK',
  discNumber: 'TPOS',
};

const encodeLatin1 = (value: string): Uint8Array => Uint8Array.from([...value].map(c => c.charCodeAt(0) & 0xff));
const u32be = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

const isValidId3TextFrameId = (id: string): id is Id3TextFrameId => ID3_TEXT_FRAME_IDS.includes(id as Id3TextFrameId);

export const serializeId3TextFrame = (id: string, value: string): Uint8Array => {
  if (!isValidId3TextFrameId(id)) throw new TagWriterError('InvalidTagData', `Unsupported ID3 text frame id: ${id}`);
  const normalizedValue = value.trim();
  if (!normalizedValue) throw new TagWriterError('InvalidTagData', 'ID3 text frame value must not be empty.');

  const payload = new Uint8Array(1 + normalizedValue.length);
  payload[0] = 0x00;
  payload.set(encodeLatin1(normalizedValue), 1);
  const out = new Uint8Array(10 + payload.length);
  out.set(encodeLatin1(id), 0);
  out.set(u32be(payload.length), 4);
  out[8] = 0;
  out[9] = 0;
  out.set(payload, 10);
  return out;
};

export const buildMp3TextFrames = (tags: EditableTrackTags): Uint8Array[] => {
  const normalized = normalizeEditableTags(tags);
  return Object.entries(ID3_TEXT_FRAME_MAP)
    .flatMap(([key, frameId]) => {
      const value = normalized[key as keyof EditableTrackTags];
      if (!frameId || !value) return [];
      return [serializeId3TextFrame(frameId, value)];
    });
};

export const prepareTagEditPlan = (song: Song, draft: TagEditDraft): TagEditPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  if (!uri) throw new TagWriterError('UnsupportedUri', 'Song has no editable URI.');
  const capability = getTagEditCapability(song);
  const container = getSupportedContainer(song);

  if (capability.uriType === 'unknown') throw new TagWriterError('UnsupportedUri', 'Unsupported URI type for editing.');

  const warnings = [...(capability.reason ? [capability.reason] : [])];
  if (draft.removeCover && draft.cover) warnings.push('removeCover=true takes precedence over cover payload.');
  if (container === 'm4a' || container === 'mp4') warnings.push('MP4/M4A writing intentionally blocked until safe atom rewrite is implemented.');

  return {
    uri,
    uriType: getUriType(uri),
    container,
    requiresBackup: true,
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: capability.uriType === 'file' ? 'medium' : 'high',
    warnings,
  };
};

export const applyTagEditToBuffer = (buffer: Uint8Array, container: TagEditableContainer, draft: TagEditDraft): Uint8Array => {
  const validation = validateEditableTags(draft.tags);
  if (!validation.valid) throw new TagWriterError('InvalidTagData', validation.errors.join('; '));
  if (!validateCoverPayload(draft.cover)) throw new TagWriterError('InvalidTagData', 'Invalid cover payload.');
  if (container === 'unsupported') throw new TagWriterError('UnsupportedFormat', 'Container not supported.');
  if (container === 'm4a' || container === 'mp4') throw new TagWriterError('WriteNotImplemented', 'MP4/M4A writing not implemented safely yet.');
  if (container === 'mp3') {
    if (buffer.length === 0) throw new TagWriterError('InvalidTagData', 'Empty buffer.');
    buildMp3TextFrames(draft.tags);
    throw new TagWriterError('WriteNotImplemented', 'MP3 rewrite is not yet enabled for full-file safety.');
  }
  throw new TagWriterError('UnsupportedFormat', 'Unknown container.');
};

export const writeTagsToFile = async (): Promise<never> => {
  throw new TagWriterError('WriteNotImplemented', 'Device file writes are intentionally disabled in this preparation step.');
};
