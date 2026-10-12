import { getActiveSafWrite, hasActiveSafWriteOperations } from './tagWriterLocks';

export class TagSourceBusyError extends Error {
  constructor() {
    super('Die Tags dieser Datei werden gerade sicher gespeichert. Bitte danach erneut abspielen.');
    this.name = 'TagSourceBusyError';
  }
}

export const assertTagSourceAvailableForPlayback = (uri: string): void => {
  if (hasActiveSafWriteOperations() && getActiveSafWrite(uri)) throw new TagSourceBusyError();
};

