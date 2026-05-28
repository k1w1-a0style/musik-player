import * as ImagePicker from 'expo-image-picker';
import { buildEditableCoverFromPickerAsset, type PickedTagCover } from '../utils/tagCoverPicker';
import { COVER_PICK_ERROR_MESSAGES } from './tagEditorHelpers';

export type TagEditorCoverPickResult =
  | { status: 'selected'; cover: PickedTagCover; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'permissionDenied'; message: string }
  | { status: 'failed'; message: string };

const COVER_PERMISSION_DENIED_MESSAGE =
  'Zugriff auf Fotos wurde verweigert. Bitte Berechtigung in den Systemeinstellungen erlauben.';
const COVER_PICK_FAILED_MESSAGE = 'Cover-Auswahl fehlgeschlagen. Bitte erneut versuchen.';

const permissionErrorPattern = /permission|denied|access|unauthori[sz]ed|not authorized/i;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const isPickerPermissionError = (error: unknown): boolean =>
  permissionErrorPattern.test(getErrorMessage(error));

export const pickTagEditorCover = async (): Promise<TagEditorCoverPickResult> => {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      base64: true,
    });
  } catch (error) {
    console.warn('[CoverPicker] Image picker failed.', error);
    if (isPickerPermissionError(error)) {
      return { status: 'permissionDenied', message: COVER_PERMISSION_DENIED_MESSAGE };
    }
    return { status: 'failed', message: COVER_PICK_FAILED_MESSAGE };
  }

  if (result.canceled) {
    return { status: 'cancelled', message: 'Cover-Auswahl abgebrochen.' };
  }

  const asset = result.assets[0];
  if (!asset) {
    console.warn('[CoverPicker] Picker returned no asset.');
    return { status: 'failed', message: COVER_PICK_ERROR_MESSAGES.missingUri };
  }

  const coverResult = buildEditableCoverFromPickerAsset(asset);

  if (!coverResult.ok) {
    console.warn('[CoverPicker] Invalid cover asset selected.', { reason: coverResult.reason });
    return { status: 'failed', message: COVER_PICK_ERROR_MESSAGES[coverResult.reason] };
  }

  return {
    status: 'selected',
    cover: coverResult.cover,
    message: 'Neues Cover ausgewählt. Speichern schreibt es in die Datei.',
  };
};
