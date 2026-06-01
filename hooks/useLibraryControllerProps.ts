import { useLibraryComponentProps, type UseLibraryComponentPropsOptions, type UseLibraryComponentPropsResult } from './useLibraryComponentProps';

export type UseLibraryControllerPropsOptions = UseLibraryComponentPropsOptions;
export type UseLibraryControllerPropsResult = UseLibraryComponentPropsResult;

export const useLibraryControllerProps = (options: UseLibraryControllerPropsOptions): UseLibraryControllerPropsResult => useLibraryComponentProps(options);
