declare module 'expo-image-picker' {
  export const MediaTypeOptions: {
    Images: 'Images';
  };

  export type ImagePickerAsset = {
    uri: string;
    mimeType?: string | null;
    base64?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    width?: number;
    height?: number;
  };

  export type ImagePickerPermissionResponse = {
    granted?: boolean;
    status?: string;
  };

  export type ImagePickerResult =
    | { canceled: true; cancelled?: true; assets?: ImagePickerAsset[] }
    | { canceled: false; cancelled?: false; assets: ImagePickerAsset[] };

  export function getMediaLibraryPermissionsAsync(): Promise<ImagePickerPermissionResponse>;
  export function requestMediaLibraryPermissionsAsync(): Promise<ImagePickerPermissionResponse>;
  export function launchImageLibraryAsync(options?: unknown): Promise<ImagePickerResult>;
}
