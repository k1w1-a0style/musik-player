import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TagEditor from '../TagEditor';

const mockWriteTagsToFile = jest.fn();
let mockSongId = 's1';
let mockSongs: any[] = [];
let mockCapability = { canRead: true, canWrite: true, uriType: 'file', reason: 'ok', supportedContainer: 'mp3' };

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockSongId } }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock('../../contexts/MusicContext', () => ({ useLibraryMusicContext: () => ({ songs: mockSongs }) }));
jest.mock('../../components/AppBackground', () => ({ children }: any) => children);
jest.mock('../../components/Screen', () => ({ children }: any) => children);
jest.mock('../../utils/tagEditCapability', () => ({ getTagEditCapability: () => mockCapability }));
jest.mock('../../utils/tagWriteOrchestrator', () => ({ createTagWriteOperationPlan: () => ({ blockingReasons: [] }) }));
jest.mock('../../utils/tagWriter', () => {
  class TagWriterError extends Error { constructor(code: string, message: string) { super(message); (this as any).code = code; } }
  return { writeTagsToFile: (...args: any[]) => mockWriteTagsToFile(...args), TagWriterError };
});

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => buttons?.[1]?.onPress?.());
  mockCapability = { canRead: true, canWrite: true, uriType: 'file', reason: 'ok', supportedContainer: 'mp3' };
  mockSongs = [{ id: 's1', title: 'A', artist: 'B', album: 'C', uri: 'file:///x.mp3', fileInfo: { extension: 'mp3', uri: 'file:///x.mp3' } }];
  mockWriteTagsToFile.mockReset();
});

test('renders current song and unchanged save does not write', () => {
  const { getByDisplayValue, getByText } = render(<TagEditor />);
  expect(getByDisplayValue('A')).toBeTruthy();
  fireEvent.press(getByText('Speichern'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('not found state', () => {
  mockSongId = '404';
  const { getByText } = render(<TagEditor />);
  expect(getByText('Song nicht gefunden.')).toBeTruthy();
  mockSongId = 's1';
});

test('content uri blocked message and save blocked', () => {
  mockCapability = { canRead: true, canWrite: false, uriType: 'content', reason: 'Requires SAF persistable write permission and provider write support.', supportedContainer: 'mp3' };
  const { getByText } = render(<TagEditor />);
  expect(getByText(/Requires SAF/)).toBeTruthy();
  fireEvent.press(getByText('Speichern'));
  expect(mockWriteTagsToFile).not.toHaveBeenCalled();
});

test('changed title builds draft with title only', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByDisplayValue, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByDisplayValue('A'), 'New');
  fireEvent.press(getByText('Speichern'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags).toEqual({ title: 'New' });
});

test('cleared album sends empty string', async () => {
  mockWriteTagsToFile.mockResolvedValue({ status: 'written' });
  const { getByDisplayValue, getByText } = render(<TagEditor />);
  fireEvent.changeText(getByDisplayValue('C'), '');
  fireEvent.press(getByText('Speichern'));
  await waitFor(() => expect(mockWriteTagsToFile).toHaveBeenCalled());
  expect(mockWriteTagsToFile.mock.calls[0][1].tags.album).toBe('');
});
