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

const hasImageLibraryPermission = (permission: { granted?: boolean; status?: string }): boolean =>
  permission.granted === true || permission.status === 'granted';

export const pickTagEditorCover = async (): Promise<TagEditorCoverPickResult> => {
  const existingPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
  const permission = hasImageLibraryPermission(existingPermission)
    ? existingPermission
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!hasImageLibraryPermission(permission)) {
    console.warn('[CoverPicker] Media-library permission denied.');
    return { status: 'permissionDenied', message: COVER_PERMISSION_DENIED_MESSAGE };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
    base64: true,
  });

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
