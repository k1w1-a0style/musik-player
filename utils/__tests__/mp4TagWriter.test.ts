import { applyTagEditToBuffer, TagWriterError } from '../tagWriter';

const u8 = (...x: number[]) => new Uint8Array(x);
const te = new TextEncoder();
const atom = (type: Uint8Array, payload: Uint8Array) => {
  const out = new Uint8Array(8 + payload.length);
  const size = out.length;
  out[0] = (size >>> 24) & 0xff; out[1] = (size >>> 16) & 0xff; out[2] = (size >>> 8) & 0xff; out[3] = size & 0xff;
  out.set(type, 4); out.set(payload, 8);
  return out;
};
const types = {
  ftyp: te.encode('ftyp'), moov: te.encode('moov'), mdat: te.encode('mdat'), udta: te.encode('udta'), meta: te.encode('meta'), ilst: te.encode('ilst'), data: te.encode('data'),
  nam: u8(0xa9, 0x6e, 0x61, 0x6d), art: u8(0xa9, 0x41, 0x52, 0x54), covr: te.encode('covr'), trkn: te.encode('trkn'), unk: te.encode('----'),
};
const dataAtom = (kind: number, payload: Uint8Array) => atom(types.data, new Uint8Array([(kind>>>24)&0xff,(kind>>>16)&0xff,(kind>>>8)&0xff,kind&0xff,0,0,0,0,...payload]));
const item = (type: Uint8Array, data: Uint8Array) => atom(type, dataAtom(1, data));
const ilst = (...items: Uint8Array[]) => atom(types.ilst, Uint8Array.from(items.flatMap((x) => Array.from(x))));
const meta = (ilstAtom: Uint8Array) => atom(types.meta, new Uint8Array([0,0,0,0,...ilstAtom]));
const udta = (metaAtom: Uint8Array) => atom(types.udta, metaAtom);
const moov = (udtaAtom: Uint8Array) => atom(types.moov, udtaAtom);
const file = (moovFirst: boolean, ilstAtom: Uint8Array) => {
  const ftyp = atom(types.ftyp, u8(0,0,0,0)); const mdat = atom(types.mdat, u8(1,2,3,4,5,6)); const moovAtom = moov(udta(meta(ilstAtom)));
  return Uint8Array.from((moovFirst ? [ftyp, moovAtom, mdat] : [ftyp, mdat, moovAtom]).flatMap((x) => Array.from(x)));
};

test('mp4 title edit works when moov is after mdat and keeps mdat bytes', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old')), item(types.art, te.encode('artist'))));
  const out = applyTagEditToBuffer(src, 'm4a', { songId: '1', tags: { title: 'new' } });
  expect(Array.from(out.slice(20, 26))).toEqual([1,2,3,4,5,6]);
  expect(new TextDecoder().decode(out).includes('new')).toBe(true);
  expect(new TextDecoder().decode(out).includes('artist')).toBe(true);
});

test('moov before mdat and size change is blocked', () => {
  const src = file(true, ilst(item(types.nam, te.encode('a'))));
  expect(() => applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { title: 'this is longer' } })).toThrow(/moov-before-mdat/i);
});

test('unknown ilst entries are preserved', () => {
  const unknown = atom(types.unk, dataAtom(1, te.encode('keep')));
  const src = file(false, ilst(unknown, item(types.nam, te.encode('old'))));
  const out = applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { title: 'new' } });
  expect(new TextDecoder().decode(out).includes('keep')).toBe(true);
});

test('untouched known fields are not duplicated', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old')), item(types.art, te.encode('artist'))));
  const out = applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { title: 'new' } });
  const decoded = new TextDecoder().decode(out);
  expect(decoded.match(/artist/g)?.length ?? 0).toBe(1);
});

test('cover is preserved when there is no cover intent', () => {
  const covr = atom(types.covr, dataAtom(13, u8(0xff, 0xd8, 0xff, 0xdb)));
  const src = file(false, ilst(item(types.nam, te.encode('old')), covr));
  const out = applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { title: 'new' } });
  expect(Array.from(out).includes(0xdb)).toBe(true);
});

test('invalid nested size=0 throws', () => {
  const badIlstItem = new Uint8Array([0,0,0,0, ...types.nam, 0,0,0,8, ...types.data]);
  const src = file(false, ilst(badIlstItem));
  expect(() => applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { title: 'x' } })).toThrow(TagWriterError);
});

test('invalid track format throws InvalidTagData', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old'))));
  expect(() => applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { trackNumber: 'abc' } })).toThrow(/Invalid track number/i);
});

test('no-op draft returns original bytes', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old'))));
  const out = applyTagEditToBuffer(src, 'm4a', { songId: '1', tags: {} });
  expect(Array.from(out)).toEqual(Array.from(src));
});

test('removeCover true with no existing covr is no-op', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old'))));
  const out = applyTagEditToBuffer(src, 'm4a', { songId: '1', tags: {}, removeCover: true });
  expect(Array.from(out)).toEqual(Array.from(src));
});

test('invalid disc format throws InvalidTagData', () => {
  const src = file(false, ilst(item(types.nam, te.encode('old'))));
  expect(() => applyTagEditToBuffer(src, 'mp4', { songId: '1', tags: { discNumber: 'x/y' } })).toThrow(/Invalid disc number/i);
});
