import { parseId3FromUri } from '../id3Parser';

const mockReadAsStringAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockFileBytes = jest.fn();
const mockOpen = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    bytes() {
      return mockFileBytes();
    }

    open() {
      return mockOpen();
    }
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
}));

const latin1 = (value: string): number[] =>
  Array.from(value, character => character.charCodeAt(0) & 0xff);

const utf8 = (value: string): number[] => Array.from(Buffer.from(value, 'utf8'));

const utf16Le = (value: string): number[] => [
  0xff,
  0xfe,
  ...Array.from(value).flatMap(character => {
    const code = character.charCodeAt(0);
    return [code & 0xff, code >> 8];
  }),
];

const utf16Be = (value: string): number[] =>
  Array.from(value).flatMap(character => {
    const code = character.charCodeAt(0);
    return [code >> 8, code & 0xff];
  });

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

const bytesForEncoding = (encoding: number, value: string): number[] => {
  if (encoding === 0x01) return utf16Le(value);
  if (encoding === 0x02) return utf16Be(value);
  if (encoding === 0x03) return utf8(value);
  return latin1(value);
};

const commentFrame = (
  encoding: number,
  description: string,
  text: string,
): number[] => {
  const separator = encoding === 0x01 || encoding === 0x02 ? [0, 0] : [0];
  const body = [
    encoding,
    ...latin1('eng'),
    ...bytesForEncoding(encoding, description),
    ...separator,
    ...bytesForEncoding(encoding, text),
  ];
  return [...latin1('COMM'), ...u32be(body.length), 0, 0, ...body];
};

const rawFrame = (id: string, body: number[]): number[] => [
  ...latin1(id),
  ...u32be(body.length),
  0,
  0,
  ...body,
];

const buildId3 = (frames: number[][]): string => {
  const frameBytes = frames.flat();
  const bytes = [
    ...latin1('ID3'),
    3,
    0,
    0,
    ...synchsafe(frameBytes.length),
    ...frameBytes,
  ];
  return Buffer.from(Uint8Array.from(bytes)).toString('base64');
};

describe('ID3 COMM frame decoding contract', () => {
  beforeEach(() => {
    mockReadAsStringAsync.mockReset();
    mockGetInfoAsync.mockReset();
    mockFileBytes.mockReset();
    mockOpen.mockReset();
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 4096 });
  });

  test.each([
    ['Latin-1', 0x00, 'Beschreibung', 'Grüße aus Köln'],
    ['UTF-16 with BOM', 0x01, 'Beschreibung', 'Kommentar Ω'],
    ['UTF-16BE', 0x02, 'Beschreibung', 'Kommentar Ä'],
    ['UTF-8', 0x03, 'Beschreibung', 'Grüße 🚀'],
  ] as const)('decodes %s description and text', async (_name, encoding, description, text) => {
    mockReadAsStringAsync.mockResolvedValueOnce(
      buildId3([commentFrame(encoding, description, text)]),
    );

    await expect(parseId3FromUri('file:///music/comment.mp3')).resolves.toMatchObject({
      comment: text,
    });
  });

  test('prefers an undescribed comment over a described fallback', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(
      buildId3([
        commentFrame(0x03, 'notes', 'Fallback comment'),
        commentFrame(0x03, '', 'Primary comment'),
      ]),
    );

    await expect(parseId3FromUri('file:///music/comment-priority.mp3')).resolves.toMatchObject({
      comment: 'Primary comment',
    });
  });

  test('uses a described comment when no undescribed comment exists', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(
      buildId3([commentFrame(0x00, 'notes', 'Only fallback')]),
    );

    await expect(parseId3FromUri('file:///music/comment-fallback.mp3')).resolves.toMatchObject({
      comment: 'Only fallback',
    });
  });

  test('trims encoded description and comment text', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(
      buildId3([commentFrame(0x03, '  notes  ', '  Trimmed comment  ')]),
    );

    await expect(parseId3FromUri('file:///music/comment-trim.mp3')).resolves.toMatchObject({
      comment: 'Trimmed comment',
    });
  });

  test('ignores a truncated COMM body without throwing', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(
      buildId3([rawFrame('COMM', [0x03, 0x65, 0x6e])]),
    );

    await expect(parseId3FromUri('file:///music/truncated-comment.mp3')).resolves.toEqual({});
  });
});
