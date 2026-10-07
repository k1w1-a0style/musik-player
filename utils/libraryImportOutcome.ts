import type { ImportScanResult } from './mediaLibraryImport';

export const getImportVerificationAlert = (result: Pick<ImportScanResult, 'completed' | 'remainingCount' | 'unverifiedCount' | 'errors'>,
  fullScan: boolean) => {
  if (result.completed === false) return {
    title: 'Scan teilweise abgeschlossen',
    message: `Bestätigte Titel bleiben gespeichert. ${result.errors?.length ?? 0} Leseproblem(e)`
      + (result.remainingCount ? `, ${result.remainingCount} Datei(en) noch nicht geprüft` : '')
      + '. Scan wiederholen, um die übrigen Dateien zu prüfen.'
      + (result.unverifiedCount ? ` ${result.unverifiedCount} Revision(en) konnten nicht verifiziert werden.` : ''),
  };
  if (!result.unverifiedCount) return undefined;
  return fullScan ? {
    title: 'Inhaltsprüfung unvollständig',
    message: `${result.unverifiedCount} Datei(en) konnten nicht anhand ihres Inhalts verifiziert werden. Vorhandene Titel bleiben erhalten.`,
  } : {
    title: 'Schnellscan abgeschlossen',
    message: `${result.unverifiedCount} bekannte Datei(en) wurden ohne verlässliche Änderungsdaten wiederverwendet. Änderungen gleicher Größe sind damit nicht ausgeschlossen. „Vollständiger Scan“ prüft auch den Dateiinhalt.`,
  };
};
