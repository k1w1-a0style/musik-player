import * as ImagePicker from 'expo-image-picker';
import { buildEditableCoverFromPickerAsset, type PickedTagCover } from '../utils/tagCoverPicker';
import { COVER_PICK_ERROR_MESSAGES } from './tagEditorHelpers';

export type TagEditorCoverPickResult =
  | { status: 'selected'; cover: PickedTagCover; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'failed'; message: string };

export const pickTagEditorCover = async (): Promise<TagEditorCoverPickResult> => {
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
  const coverResult = buildEditableCoverFromPickerAsset(asset);

  if (!coverResult.ok) {
    return { status: 'failed', message: COVER_PICK_ERROR_MESSAGES[coverResult.reason] };
  }

  return {
    status: 'selected',
    cover: coverResult.cover,
    message: 'Neues Cover ausgewählt. Speichern schreibt es in die Datei.',
  };
};
