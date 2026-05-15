import { Alert } from 'react-native';
import { confirmLibraryImport } from '../libraryImportConfirmation';

test('resolves true when import is confirmed', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  });

  await expect(confirmLibraryImport(12, 3)).resolves.toBe(true);
  expect(Alert.alert).toHaveBeenCalledWith(
    'Musik importieren',
    '12 Musikdateien gefunden. 3 kurze Audios, Sprachnachrichten oder Systemtöne wurden übersprungen.',
    expect.any(Array),
    expect.objectContaining({ cancelable: true }),
  );
});

test('resolves false when import is cancelled', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[0]?.onPress?.();
  });

  await expect(confirmLibraryImport(1, 0)).resolves.toBe(false);
});

test('resolves false when dialog is dismissed', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, _buttons, options) => {
    options?.onDismiss?.();
  });

  await expect(confirmLibraryImport(1, 0)).resolves.toBe(false);
});
