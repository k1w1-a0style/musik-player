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

  export type ImagePickerResult =
    | { canceled: true; cancelled?: true; assets?: ImagePickerAsset[] }
    | { canceled: false; cancelled?: false; assets: ImagePickerAsset[] };

  export function launchImageLibraryAsync(options?: unknown): Promise<ImagePickerResult>;
}
