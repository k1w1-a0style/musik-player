import * as ImagePicker from 'expo-image-picker';
import { pickTagEditorCover } from '../tagEditorCoverPicker';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(),
}));

const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('pickTagEditorCover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns cancelled result when picker is cancelled', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });

    await expect(pickTagEditorCover()).resolves.toEqual({
      status: 'cancelled',
      message: 'Cover-Auswahl abgebrochen.',
    });
  });

  test('returns failed result for invalid cover asset', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cover.gif', mimeType: 'image/gif', base64: 'abc' }],
    });

    await expect(pickTagEditorCover()).resolves.toEqual({
      status: 'failed',
      message: 'Nur JPG/JPEG und PNG werden als Cover unterstützt.',
    });
  });

  test('returns selected cover result for valid asset', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cover.jpg', mimeType: 'image/jpeg', base64: Buffer.from('cover').toString('base64') }],
    });

    const result = await pickTagEditorCover();

    expect(result.status).toBe('selected');
    expect(result.message).toBe('Neues Cover ausgewählt. Speichern schreibt es in die Datei.');
    if (result.status === 'selected') {
      expect(result.cover.uri).toBe('file:///cover.jpg');
      expect(result.cover.mimeType).toBe('image/jpeg');
      expect(result.cover.sizeBytes).toBe(5);
    }
  });
});
