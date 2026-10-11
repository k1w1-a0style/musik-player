import { inspectMp4Metadata } from '../mp4MetadataInspection';

const concat = (...parts: Uint8Array[]): Uint8Array => Uint8Array.from(parts.flatMap(part => Array.from(part)));
const atom = (type: string, payload: Uint8Array = new Uint8Array(), extended = false): Uint8Array => {
  const bytes = new Uint8Array(payload.length + (extended ? 16 : 8)); const view = new DataView(bytes.buffer);
  view.setUint32(0, extended ? 1 : bytes.length); bytes.set(Array.from(type, char => char.charCodeAt(0)), 4);
  if (extended) { view.setUint32(8, 0); view.setUint32(12, bytes.length); }
  bytes.set(payload, extended ? 16 : 8); return bytes;
};
const ftyp = (brand = 'M4A ') => atom('ftyp', new TextEncoder().encode(`${brand}\0\0\0\0isom`));
const meta = (items: Uint8Array = new Uint8Array()) => atom('meta', concat(new Uint8Array(4), atom('ilst', items)));
const moov = (payload: Uint8Array = meta()) => atom('moov', atom('udta', payload));
const file = (...metadata: Uint8Array[]) => concat(ftyp(), atom('mdat', new Uint8Array(32)), ...metadata);
const inspect = (bytes: Uint8Array, overrides = {}) => inspectMp4Metadata({
  head: bytes.subarray(0, 16), size: bytes.length,
  readRange: async (offset, length) => bytes.subarray(offset, offset + length), headBudget: 4096, tailBudget: 4096,
  includeCover: true, ...overrides,
});

test('recognizes known fields and structural track atoms without decoding the values', async () => {
  const data = atom('data', new Uint8Array(8));
  const tracks = atom('trak', concat(atom('tkhd'), atom('mdia', concat(atom('mdhd'), atom('hdlr'),
    atom('minf', atom('stbl', atom('stsd')))))));
  const bytes = file(atom('moov', concat(tracks, atom('udta', meta(concat(atom('©alb', data), atom('aART', data),
    atom('©day', data), atom('gnre', data), atom('trkn', data), atom('disk', data), atom('©cmt', data), atom('covr', data), atom('©nam', data)))))));
  expect((await inspect(bytes))?.absentFields).toEqual([]);
});

test('reuses a complete head moov without additional file reads', async () => {
  const bytes = file(moov()); const readRange = jest.fn();
  expect((await inspect(bytes, { head: bytes, readRange }))?.absentFields).toContain('album');
  expect(readRange).not.toHaveBeenCalled();
});

test('walks a 200 MB audio atom using headers, not the audio payload', async () => {
  const start = ftyp(); const size = 200 * 1024 * 1024; const end = moov(); const audioHeader = atom('mdat');
  new DataView(audioHeader.buffer).setUint32(0, size);
  const readRange = jest.fn(async (offset: number, length: number) => {
    if (offset === 0) return start.subarray(0, length);
    if (offset === 8) return start.subarray(8, 8 + length);
    if (offset === start.length) return concat(audioHeader, new Uint8Array(8)).subarray(0, length);
    if (offset === start.length + size) return end.subarray(0, length);
    throw new Error('Audio payload must not be read');
  });
  expect((await inspectMp4Metadata({ head: start, size: start.length + size + end.length, readRange,
    headBudget: 16, tailBudget: 256, includeCover: false }))?.absentFields).toContain('album');
  expect(readRange.mock.calls.reduce((total, [, length]) => total + length, 0)).toBeLessThan(256);
});

test('accepts bounded extended-size atom headers', async () => {
  expect((await inspect(concat(ftyp(), atom('mdat', new Uint8Array(4), true),
    atom('moov', atom('udta', meta()), true))))?.absentFields).toContain('album');
});

test.each([
  ['unknown top-level atom', file(moov(), atom('uuid'))],
  ['duplicate moov', file(moov(), moov())],
  ['duplicate ftyp', file(moov(), ftyp())],
  ['unsupported brand', concat(ftyp('qt  '), atom('mdat', new Uint8Array(4)), moov())],
  ['absent audio payload', concat(ftyp(), atom('mdat'), moov())],
  ['absent metadata list', file(moov(atom('free')))],
  ['two metadata lists', file(moov(concat(meta(), meta())))],
  ['unknown item', file(moov(meta(atom('----', atom('data', new Uint8Array(8))))))],
  ['empty known item', file(moov(meta(atom('©alb'))))],
  ['short data flags', file(moov(meta(atom('©alb', atom('data', new Uint8Array(7))))))],
  ['unsupported value container', file(moov(meta(atom('©alb', atom('uuid', new Uint8Array(8))))))],
  ['unknown nested container', file(moov(atom('uuid')))],
  ['truncated meta flags', file(moov(atom('meta', new Uint8Array(3))))],
  ['unsupported meta version', file(moov(atom('meta', concat(new Uint8Array([1, 0, 0, 0]), atom('ilst')))))],
])('keeps absence unknown for %s', async (_name, bytes) => {
  expect(await inspect(bytes)).toBeUndefined();
});

test('rejects oversized or incomplete metadata before declaring any field absent', async () => {
  const bytes = file(moov());
  expect(await inspect(bytes, { tailBudget: 1 })).toBeUndefined();
  expect(await inspect(bytes, { head: bytes, headBudget: 1 })).toBeUndefined();
  expect(await inspect(bytes, { size: NaN })).toBeUndefined();
  expect(await inspect(bytes, { size: 0 })).toBeUndefined();
  expect(await inspect(bytes, { size: 2 })).toBeUndefined();
  expect(await inspect(bytes, { readRange: async () => new Uint8Array(2) })).toBeUndefined();
  const rootStart = ftyp().length + 40;
  expect(await inspect(bytes, { readRange: async (offset: number, length: number) =>
    bytes.subarray(offset, offset + (offset === rootStart && length > 16 ? length - 1 : length)) })).toBeUndefined();
});

test('rejects zero-sized, unsafe 64-bit, and truncated atom chains', async () => {
  const zero = file(moov()); new DataView(zero.buffer).setUint32(0, 0);
  expect(await inspect(zero)).toBeUndefined();
  const unsafe = atom('mdat', new Uint8Array(4), true); new DataView(unsafe.buffer).setUint32(8, 0xffffffff);
  expect(await inspect(concat(ftyp(), unsafe, moov()))).toBeUndefined();
  const bytes = file(moov()); expect(await inspect(bytes.subarray(0, bytes.length - 1))).toBeUndefined();
  expect(await inspect(concat(bytes, new Uint8Array(3)))).toBeUndefined();
});

test('bounds traversal for excessive top-level atoms, nesting, and children', async () => {
  expect(await inspect(concat(ftyp(), ...Array.from({ length: 65 }, () => atom('free')), atom('mdat', new Uint8Array(4)), moov()))).toBeUndefined();
  let deep = meta(); for (let level = 0; level < 10; level += 1) deep = atom('udta', deep);
  expect(await inspect(file(moov(deep)))).toBeUndefined();
  expect(await inspect(file(moov(concat(...Array.from({ length: 1025 }, () => atom('free'))))), { tailBudget: 20_000 })).toBeUndefined();
});
