import * as ImagePicker from 'expo-image-picker';
import { pickTagEditorCover } from '../tagEditorCoverPicker';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockGetMediaLibraryPermissionsAsync = ImagePicker.getMediaLibraryPermissionsAsync as jest.Mock;
const mockRequestMediaLibraryPermissionsAsync = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchImageLibraryAsync = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('pickTagEditorCover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
  });


  test('returns permissionDenied and does not launch picker when permission is denied', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false, status: 'undetermined' });
    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' });

    await expect(pickTagEditorCover()).resolves.toEqual({
      status: 'permissionDenied',
      message: 'Zugriff auf Fotos wurde verweigert. Bitte Berechtigung in den Systemeinstellungen erlauben.',
    });
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
    expect(mockRequestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  test('does not request permission twice when already granted', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });

    await pickTagEditorCover();

    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
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
