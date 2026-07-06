import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TagEditor from '../TagEditor';

const mockGetMediaLibraryPermissionsAsync = jest.fn();
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockWriteTagsToFile = jest.fn();
const mockUpdateSongMetadata = jest.fn();
const mockSongId = 's1';
let mockSongs: Array<{
  id: string;
  title: string;
  artist: string;
  album: string;
  uri: string;
  cover: string;
  coverInfo: { status: 'external'; uri: string };
  fileInfo: { extension: string; uri: string };
}> = [];
let mockCapability = {
  canRead: true,
  canWrite: true,
  uriType: 'file',
  reason: 'ok',
  supportedContainer: 'mp3',
};
let mockPlan = { blockingReasons: [] as string[] };

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: () => mockGetMediaLibraryPermissionsAsync(),
  requestMediaLibraryPermissionsAsync: () => mockRequestMediaLibraryPermissionsAsync(),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibraryAsync(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockSongId } }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    songs: mockSongs,
    updateSongMetadata: mockUpdateSongMetadata,
  }),
}));

jest.mock(
  '../../components/AppBackground',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children,
);

jest.mock(
  '../../components/Screen',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children,
);

jest.mock('../../utils/tagEditCapability', () => ({
  getTagEditCapability: () => mockCapability,
}));

jest.mock('../../utils/tagWriteOrchestrator', () => ({
  createTagWriteOperationPlan: () => mockPlan,
}));

jest.mock('../../utils/tagWriter', () => {
  class TagWriterError extends Error {
    constructor(code: string, message: string) {
      super(message);
      Object.defineProperty(this, 'code', { value: code });
    }
  }
  return {
    writeTagsToFile: (...args: unknown[]) => mockWriteTagsToFile(...args),
    TagWriterError,
  };
});

const gifBase64 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).toString('base64');
const jpgBytes = [0xff, 0xd8, 0xff, 0x00];
const jpgBase64 = Buffer.from(jpgBytes).toString('base64');

beforeEach(() => {
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons?: Array<{ onPress?: () => void }>) => buttons?.[1]?.onPress?.());
  mockCapability = {
    canRead: true,
    canWrite: true,
    uriType: 'file',
    reason: 'ok',
    supportedContainer: 'mp3',
  };
  mockPlan = { blockingReasons: [] };
  mockSongs = [
    {
      id: 's1',
      title: 'A',
      artist: 'B',
      album: 'C',
      uri: 'file:///x.mp3',
      cover: 'file:///old-cover.jpg',
      coverInfo: { status: 'external', uri: 'file:///old-cover.jpg' },
      fileInfo: { extension: 'mp3', uri: 'file:///x.mp3' },
    },
  ];
  mockGetMediaLibraryPermissionsAsync.mockReset();
  mockRequestMediaLibraryPermissionsAsync.mockReset();
  mockGetMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
  mockLaunchImageLibraryAsync.mockReset();
  mockWriteTagsToFile.mockReset();
  mockUpdateSongMetadata.mockReset();
});

test('cover controls expose German accessibility labels before picking a cover', () => {
  const { getByTestId } = render(<TagEditor />);

  expect(getByTestId('remove-cover').props.accessibilityLabel).toBe('Cover entfernen');
  expect(getByTestId('pick-cover').props.accessibilityLabel).toBe(
    'Cover auswählen (JPG/PNG, max. 5 MB)',
  );
});

test('cover editor shows the current cover before a replacement is picked', () => {
  const { getByTestId, getByText } = render(<TagEditor />);

  expect(getByTestId('cover-preview')).toBeTruthy();
  expect(getByTestId('cover-preview-image').props.source).toEqual({ uri: 'file:///old-cover.jpg' });
  expect(getByText('Aktuelles Cover')).toBeTruthy();
});

test('cancelled cover picker shows a status and keeps save disabled', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
  const { getByTestId, getByText } = render(<TagEditor />);

  fireEvent.press(getByTestId('pick-cover'));

  await waitFor(() => expect(getByText('Cover-Auswahl abgebrochen.')).toBeTruthy());
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('unsupported picked cover type is rejected', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ base64: gifBase64, mimeType: 'image/gif', uri: 'file:///cover.gif' }],
  });
  const { getByTestId, getByText } = render(<TagEditor />);

  fireEvent.press(getByTestId('pick-cover'));

  await waitFor(() => expect(getByText('Nur JPG/JPEG und PNG werden als Cover unterstützt.')).toBeTruthy());
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('valid picked cover enables save and writes cover draft', async () => {
  mockLaunchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ base64: jpgBase64, mimeType: 'image/jpeg', uri: 'file:///new-cover.jpg' }],
  });
  mockWriteTagsToFile.mockResolvedValue({ status: 'written', warnings: [] });
  const { getByTestId, getByText } = render(<TagEditor />);

  fireEvent.press(getByTestId('pick-cover'));

  await waitFor(() => expect(getByText('Neues Cover ausgewählt. Speichern schreibt es in die Datei.')).toBeTruthy());
  expect(getByTestId('pick-cover').props.accessibilityLabel).toBe('Cover ausgewählt — tippen zum Ändern');
  expect(getByTestId('cover-preview')).toBeTruthy();
  expect(getByTestId('cover-preview-image').props.source).toEqual({ uri: 'file:///new-cover.jpg' });
  expect(getByText('Ausgewähltes neues Cover')).toBeTruthy();
  expect(getByTestId('remove-cover').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(false);

  fireEvent.press(getByTestId('save-button'));

  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  const draft = mockWriteTagsToFile.mock.calls[0][1];
  expect(draft.removeCover).toBeUndefined();
  expect(draft.cover.mimeType).toBe('image/jpeg');
  expect(Array.from(draft.cover.data)).toEqual(jpgBytes);
  expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', {
    cover: 'file:///new-cover.jpg',
    coverInfo: {
      status: 'external',
      uri: 'file:///new-cover.jpg',
      embeddedArtworkChecked: false,
      embeddedArtworkRevision: expect.any(Number),
      pendingEmbeddedArtworkRefresh: true,
      embeddedArtworkRefreshFailed: false,
    },
  });
});