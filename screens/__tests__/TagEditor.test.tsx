import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TagEditor, { buildDraftFromDirtyFields } from '../TagEditor';

const mockWriteTagsToFile = jest.fn();
const mockUpdateSongMetadata = jest.fn();
let mockSongId = 's1';
let mockSongs: any[] = [];
let mockCapability = { canRead: true, canWrite: true, uriType: 'file', reason: 'ok', supportedContainer: 'mp3' };
let mockPlan = { blockingReasons: [] as string[] };

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockSongId } }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({ songs: mockSongs, updateSongMetadata: mockUpdateSongMetadata }),
}));
jest.mock('../../components/AppBackground', () => ({ children }: any) => children);
jest.mock('../../components/Screen', () => ({ children }: any) => children);
jest.mock('../../utils/tagEditCapability', () => ({ getTagEditCapability: () => mockCapability }));
jest.mock('../../utils/tagWriteOrchestrator', () => ({ createTagWriteOperationPlan: () => mockPlan }));
jest.mock('../../utils/tagWriter', () => {
  class TagWriterError extends Error { constructor(code: string, message: string) { super(message); (this as any).code = code; } }
  return { writeTagsToFile: (...args: any[]) => mockWriteTagsToFile(...args), TagWriterError };
});

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => buttons?.[1]?.onPress?.());
  mockCapability = { canRead: true, canWrite: true, uriType: 'file', reason: 'ok', supportedContainer: 'mp3' };
  mockPlan = { blockingReasons: [] };
  mockSongs = [{ id: 's1', title: 'A', artist: 'B', album: 'C', uri: 'file:///x.mp3', year: '2020', genre: 'Pop', fileInfo: { extension: 'mp3', uri: 'file:///x.mp3' } }];
  mockWriteTagsToFile.mockReset();
  mockUpdateSongMetadata.mockReset();
});

test('renders fields with current song', () => {
  const { getByDisplayValue } = render(<TagEditor />);
  expect(getByDisplayValue('A')).toBeTruthy();
  expect(getByDisplayValue('B')).toBeTruthy();
  expect(getByDisplayValue('C')).toBeTruthy();
});

test('not found state', () => {
  mockSongId = '404';
  const { getByText } = render(<TagEditor />);
  expect(getByText('Song nicht gefunden.')).toBeTruthy();
  mockSongId = 's1';
});

test('canWrite false blocks save and shows reason', () => {
  mockCapability = { canRead: true, canWrite: false, uriType: 'content', reason: 'content:// Schreiben ist noch nicht unterstützt.', supportedContainer: 'mp3' };
  const { getByText, getByTestId } = render(<TagEditor />);
  expect(getByText(/content:\/\//)).toBeTruthy();
  fireEvent.press(getByTestId('save-button'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('unchanged form does not write', () => {
  const { getByTestId } = render(<TagEditor />);
  fireEvent.press(getByTestId('save-button'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('changed title builds draft only with title', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Neu');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags).toEqual({ title: 'Neu' });
});

test('cleared album keeps empty string in draft', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-album'), '');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags).toEqual({ album: '' });
});

test('written save shows success and updates context', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Neu');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Metadaten erfolgreich geschrieben.')).toBeTruthy());
  expect(mockUpdateSongMetadata).toHaveBeenCalledWith('s1', { title: 'Neu' });
});

test('noop and rolledBack status messages', async () => {
  mockWriteTagsToFile.mockResolvedValueOnce({ status: 'noop' }).mockResolvedValueOnce({ status: 'rolledBack' });
  const { getByTestId, getByText, rerender } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'X');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Keine Änderung.')).toBeTruthy());

  rerender(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Y');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText('Änderung wurde zurückgerollt.')).toBeTruthy());
});

test('shows mapped writer errors', async () => {
  const { TagWriterError } = jest.requireMock('../../utils/tagWriter');
  mockWriteTagsToFile.mockRejectedValue(new TagWriterError('InvalidTagData', 'bad'));
  const { getByTestId, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Z');
  fireEvent.press(getByTestId('save-button'));
  await waitFor(() => expect(getByText(/Ungültige Metadaten/)).toBeTruthy());
});

test('save button disabled while saving', async () => {
  let resolveFn: any;
  mockWriteTagsToFile.mockReturnValue(new Promise((resolve) => { resolveFn = resolve; }));
  const { getByTestId } = render(<TagEditor />);
  fireEvent.changeText(getByTestId('input-title'), 'Busy');
  fireEvent.press(getByTestId('save-button'));
  expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  resolveFn({ status: 'written' });
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
});

test('draft builder utility respects dirty fields/removeCover', () => {
  const form = { title: 'a', artist: 'b', album: '', year: '', genre: '', trackNumber: '', discNumber: '', comment: '' };
  const draft = buildDraftFromDirtyFields('id', form, { title: true, album: true }, true);
  expect(draft.tags).toEqual({ title: 'a', album: '' });
  expect(draft.removeCover).toBe(true);
});
