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

  test('launches system picker even when broad media-library permission is denied', async () => {
    mockGetMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' });
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cover.jpg', mimeType: 'image/jpeg', base64: Buffer.from('cover').toString('base64') }],
    });

    const result = await pickTagEditorCover();

    expect(result.status).toBe('selected');
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    if (result.status === 'selected') {
      expect(result.cover.uri).toBe('file:///cover.jpg');
      expect(result.cover.mimeType).toBe('image/jpeg');
      expect(result.cover.sizeBytes).toBe(5);
    }
  });

  test('does not request broad media-library permission in the normal image picker flow', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true });

    await pickTagEditorCover();

    expect(mockGetMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
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

  test('returns permissionDenied and logs when picker throws a permission error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('Permission denied for image picker');
    mockLaunchImageLibraryAsync.mockRejectedValue(error);

    await expect(pickTagEditorCover()).resolves.toEqual({
      status: 'permissionDenied',
      message: 'Zugriff auf Fotos wurde verweigert. Bitte Berechtigung in den Systemeinstellungen erlauben.',
    });
    expect(warnSpy).toHaveBeenCalledWith('[CoverPicker] Image picker failed.', error);

    warnSpy.mockRestore();
  });

  test('returns failed and logs when picker throws a non-permission error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('Picker crashed');
    mockLaunchImageLibraryAsync.mockRejectedValue(error);

    await expect(pickTagEditorCover()).resolves.toEqual({
      status: 'failed',
      message: 'Cover-Auswahl fehlgeschlagen. Bitte erneut versuchen.',
    });
    expect(warnSpy).toHaveBeenCalledWith('[CoverPicker] Image picker failed.', error);

    warnSpy.mockRestore();
  });
});
