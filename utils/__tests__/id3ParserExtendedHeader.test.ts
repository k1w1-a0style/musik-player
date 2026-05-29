import { parseId3Buffer } from '../id3Parser';

const enc = (value: string): number[] => Array.from(value).map(char => char.charCodeAt(0));
const u32be = (value: number): number[] => [
  (value >> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
];
const synchsafe = (value: number): number[] => [
  (value >> 21) & 0x7f,
  (value >> 14) & 0x7f,
  (value >> 7) & 0x7f,
  value & 0x7f,
];
const textFrameV23 = (id: string, text: string): number[] => {
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...u32be(body.length), 0, 0, ...body];
};
const textFrameV24 = (id: string, text: string): number[] => {
  const body = [0x00, ...enc(text)];
  return [...enc(id), ...synchsafe(body.length), 0, 0, ...body];
};
const id3 = (major: 3 | 4 | 9, flags: number, payload: number[]): Uint8Array =>
  new Uint8Array([...enc('ID3'), major, 0, flags, ...synchsafe(payload.length), ...payload]);

describe('parseId3Buffer extended headers', () => {
  it('skips ID3v2.3 extended headers before parsing frames', () => {
    const extendedHeader = [
      ...u32be(6), // ID3v2.3 extended header length excludes the 4-byte length field
      0x00, 0x00, // extended flags
      0x00, 0x00, 0x00, 0x00, // padding size
    ];
    const tags = parseId3Buffer(id3(3, 0x40, [
      ...extendedHeader,
      ...textFrameV23('TIT2', 'Extended v23'),
      ...textFrameV23('TPE1', 'Artist v23'),
    ]));

    expect(tags).toMatchObject({ title: 'Extended v23', artist: 'Artist v23' });
  });

  it('skips ID3v2.4 extended headers before parsing syncsafe-sized frames', () => {
    const extendedHeader = [
      ...synchsafe(6), // ID3v2.4 size includes the size field
      0x01, // number of flag bytes
      0x00, // flags
    ];
    const tags = parseId3Buffer(id3(4, 0x40, [
      ...extendedHeader,
      ...textFrameV24('TIT2', 'Extended v24'),
      ...textFrameV24('TALB', 'Album v24'),
    ]));

    expect(tags).toMatchObject({ title: 'Extended v24', album: 'Album v24' });
  });

  it('returns empty tags for malformed extended headers instead of parsing garbage', () => {
    const malformedExtendedHeader = [0x00, 0x00, 0x00, 0x02, 0xaa, 0xbb];

    expect(parseId3Buffer(id3(3, 0x40, [
      ...malformedExtendedHeader,
      ...textFrameV23('TIT2', 'Should not parse'),
    ]))).toEqual({});
  });

  it('ignores unsupported ID3 major versions', () => {
    expect(parseId3Buffer(id3(9, 0, textFrameV23('TIT2', 'Unknown')))).toEqual({});
  });
});
