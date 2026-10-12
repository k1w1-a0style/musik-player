import { parseFlacVorbisMetadata, parseFlacVorbisMetadataByRange } from '../flacVorbisMetadata';

const le32 = (number: number) => [number & 255, (number >>> 8) & 255, (number >>> 16) & 255, (number >>> 24) & 255];
const vector = (value: string): number[] => {
  const bytes = Array.from(Buffer.from(value, 'utf8'));
  return [...le32(bytes.length), ...bytes];
};
const comment = (fields: string[], vendor = 'independent fixture'): number[] =>
  [...vector(vendor), ...le32(fields.length), ...fields.flatMap(vector)];
const block = (type: number, bytes: number[], last = false): number[] =>
  [type | (last ? 128 : 0), (bytes.length >>> 16) & 255, (bytes.length >>> 8) & 255, bytes.length & 255, ...bytes];
const stream = (...blocks: number[][]) => Uint8Array.from([
  102, 76, 97, 67, ...block(0, Array(34).fill(0)), ...blocks.flat(),
]);
const tags = (fields: string[]) => stream(block(4, comment(fields), true));

it('reads every supported text field, UTF-8 umlauts and punctuation without inventing fields', () => {
  const bytes = tags(['TITLE= RÜFÜS / DJ Live (Remix) ', 'Artist=AC/DC', 'ALBUM=Funk\'n\'Stein',
    'ALBUMARTIST=Artist feat. DJ', 'DATE=2026-10-12', 'GENRE=Hardtek / Tribecore',
    'TRACKNUMBER=08/13', 'DISCNUMBER=1/2', 'DESCRIPTION=A=B=Comment',
    'ENCODER=Technical', 'REPLAYGAIN_TRACK_GAIN=-5.0 dB', 'MUSICBRAINZ_TRACKID=abc', 'TPUB=Label']);
  const original = bytes.slice();
  expect(parseFlacVorbisMetadata(bytes)).toEqual({ title:'RÜFÜS / DJ Live (Remix)', artist:'AC/DC',
    album:"Funk'n'Stein", albumArtist:'Artist feat. DJ', year:'2026-10-12', genre:'Hardtek / Tribecore',
    trackNumber:'08/13', discNumber:'1/2', comment:'A=B=Comment' });
  expect(bytes).toEqual(original);
});

it('preserves repeated artists/genres and rejects ambiguous singleton fields', () => {
  expect(parseFlacVorbisMetadata(tags(['ARTIST=A', 'artist=B', 'ARTIST=A', 'GENRE=Live', 'genre=Remix',
    'TITLE=First', 'title=Second', 'ALBUM=One', 'album=One']))).toEqual({ artist:'A; B', genre:'Live; Remix', album:'One' });
});

it('skips declared picture/application/padding blocks rather than parsing fake metadata in payloads', () => {
  const fake = Array.from(tags(['TITLE=Fake Audio/Picture']));
  const bytes = stream(block(6, fake), block(2, fake), block(1, fake), block(4, comment(['TITLE=Real']), true));
  expect(parseFlacVorbisMetadata(bytes)).toEqual({ title:'Real' });
  expect(parseFlacVorbisMetadata(stream(block(1, fake, true), block(4, comment(['TITLE=Audio After Last']))))).toEqual({});
  expect(parseFlacVorbisMetadata(Uint8Array.from([1, 2, 3, ...fake]))).toEqual({});
});

it.each([2,3,4])('accepts an exact complete ID3v%s prefix and retains the FLAC metadata boundary', version => {
  const prefix = [73,68,51,version,0,0,0,0,0,4,1,2,3,4];
  expect(parseFlacVorbisMetadata(Uint8Array.from([...prefix, ...tags(['TITLE=After ID3'])]))).toEqual({title:'After ID3'});
  prefix[9] = 3;
  expect(parseFlacVorbisMetadata(Uint8Array.from([...prefix, ...tags(['TITLE=Misaligned'])]))).toEqual({});
});

it('handles an ID3v2.4 footer and rejects non-synchsafe ID3 offsets', () => {
  const prefix = [73,68,51,4,0,16,0,0,0,0, ...Array(10).fill(0)];
  expect(parseFlacVorbisMetadata(Uint8Array.from([...prefix, ...tags(['TITLE=Footer'])]))).toEqual({title:'Footer'});
  prefix[8] = 128;
  expect(parseFlacVorbisMetadata(Uint8Array.from([...prefix, ...tags(['TITLE=Invalid'])]))).toEqual({});
});

it('requires the mandatory first STREAMINFO block of exactly 34 bytes', () => {
  const raw = Array.from(tags(['TITLE=Real']));
  for (const offset of [4,7]) {
    const malformed = raw.slice(); malformed[offset] += 1;
    expect(parseFlacVorbisMetadata(Uint8Array.from(malformed))).toEqual({});
  }
  expect(parseFlacVorbisMetadata(stream(block(0, Array(34).fill(0)), block(4, comment(['TITLE=Second streaminfo']), true)))).toEqual({});
  expect(parseFlacVorbisMetadata(Uint8Array.from([102,76,97,67,...block(0,Array(34).fill(0),true),...block(4,comment(['TITLE=Fake audio']))]))).toEqual({});
});

it('rejects truncated block headers/bodies, forbidden type127 and undeclared bytes', () => {
  const original = tags(['TITLE=Real']);
  for (const length of [0,3,7,20,original.length-1]) expect(parseFlacVorbisMetadata(original.subarray(0,length))).toEqual({});
  expect(parseFlacVorbisMetadata(stream(block(127, []), block(4, comment(['TITLE=No']), true)))).toEqual({});
  expect(parseFlacVorbisMetadata(stream(block(4, [...comment(['TITLE=No']),1],true)))).toEqual({});
});

it('rejects invalid UTF-8, unsigned length overflow and unbounded comment work', () => {
  for (const payload of [
    [...le32(0xffffffff)],
    [...vector('Vendor'), ...le32(0xffffffff)],
    [...vector('Vendor'), ...le32(1), ...le32(0xffffffff)],
    [...vector('Vendor'), ...le32(1), ...le32(8),84,73,84,76,69,61,0xc0,0x80],
    comment(['TITLE='+'x'.repeat(65536)]),
    comment(Array(1025).fill('TITLE=x')),
  ]) expect(parseFlacVorbisMetadata(stream(block(4, payload,true)))).toEqual({});
  expect(parseFlacVorbisMetadata(stream(...Array(128).fill(block(1,[])), block(4,comment(['TITLE=Too late']),true)))).toEqual({});
});

it('ignores absent, empty, malformed, unknown or NUL-bearing fields without unsafe prototype lookup', () => {
  expect(parseFlacVorbisMetadata(tags(['UNKNOWN=foo','TITLE=','ARTIST=A\0B','Just words','bad\nname=foo',
    '__proto__=X','constructor=Y','ALBUM ARTIST=Known']))).toEqual({albumArtist:'Known'});
});


it('range parsing skips a large picture and reads only metadata headers and the bounded comment body', async () => {
  const pictureSize = 1500 * 1024;
  const bytes = stream(block(6, Array(pictureSize).fill(255)), block(4,comment(['TITLE=After Picture','ARTIST=DJ']),true));
  const head = bytes.subarray(0,64);
  const read = jest.fn(async (position:number,length:number) => bytes.subarray(position,position+length));
  expect(await parseFlacVorbisMetadataByRange(head,read)).toEqual({title:'After Picture',artist:'DJ'});
  const header = 42+4+pictureSize;
  expect(read.mock.calls).toEqual([[header,4],[header+4,bytes.length-header-4]]);
});

it('ranged reads cannot exceed the explicit byte/offset budgets or silently accept a short range', async () => {
  const bytes = tags(['TITLE=NeedsRange']);
  for (const options of [{maxExtraReadBytes:0},{maxExtraReadBytes:3},{maxMetadataOffsetBytes:42},
    {maxExtraReadBytes:Number.NaN}]) {
    const read = jest.fn(async (position:number,length:number) => bytes.subarray(position,position+length));
    expect(await parseFlacVorbisMetadataByRange(bytes.subarray(0,42),read,options)).toEqual({});
  }
  const short = jest.fn(async () => new Uint8Array(1));
  expect(await parseFlacVorbisMetadataByRange(bytes.subarray(0,42),short)).toEqual({});
  expect(short).toHaveBeenCalledTimes(1);
});

it('ranged read errors become unknown metadata, while cancellation remains cancellation', async () => {
  const bytes = tags(['TITLE=Range']);
  expect(await parseFlacVorbisMetadataByRange(bytes.subarray(0,42), async () => {throw Error('Denied');})).toEqual({});
  const controller = new AbortController();
  const read = jest.fn(async (position:number,length:number) => { controller.abort();return bytes.subarray(position,position+length); });
  await expect(parseFlacVorbisMetadataByRange(bytes.subarray(0,42),read,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  expect(read).toHaveBeenCalledTimes(1);
  const untouched = jest.fn();
  await expect(parseFlacVorbisMetadataByRange(bytes,untouched,{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  expect(untouched).not.toHaveBeenCalled();
});

it('does not add FLAC reads to MP3, MP4, arbitrary binary or complete in-head metadata', async () => {
  for (const head of [Uint8Array.from([73,68,51,3,0,0,0,0,127,127]), Uint8Array.from([0,0,0,8,102,116,121,112]), new Uint8Array(64)]) {
    const read = jest.fn();
    expect(await parseFlacVorbisMetadataByRange(head,read)).toEqual({});
    expect(read).not.toHaveBeenCalled();
  }
  const read = jest.fn();
  expect(await parseFlacVorbisMetadataByRange(tags(['TITLE=In Head']),read)).toEqual({title:'In Head'});
  expect(read).not.toHaveBeenCalled();
});

it('ranged paths stop at declared last blocks and reject oversized comments without reading their body', async () => {
  const last = stream(block(1,[],true),block(4,comment(['TITLE=Fake Audio']),true));
  const lastRead = jest.fn(async (position:number,length:number) => last.subarray(position,position+length));
  expect(await parseFlacVorbisMetadataByRange(last.subarray(0,42),lastRead)).toEqual({});
  expect(lastRead.mock.calls).toEqual([[42,4]]);
  const oversized = stream(block(4,Array(128*1024+1).fill(0),true));
  const read = jest.fn(async (position:number,length:number) => oversized.subarray(position,position+length));
  expect(await parseFlacVorbisMetadataByRange(oversized.subarray(0,42),read)).toEqual({});
  expect(read.mock.calls).toEqual([[42,4]]);
});
