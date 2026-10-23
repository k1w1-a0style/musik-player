import { beginLibraryScan, beginLibraryScanSource, updateLibraryScanProgress, recordLibraryScanResult,
  completeLibraryScan, getLibraryScanOperation, recordLibraryScanSourceFailure } from '../libraryScanOperation';
import { emptyImportScanStatistics } from '../libraryImportStatistics';
test('both sources accumulate counts and keep first-source failures partial', () => {
  const id = beginLibraryScan(true, 'both');
  const first = { ...emptyImportScanStatistics(), newCount: 2, errorCount: 1 };
  beginLibraryScanSource(id);
  updateLibraryScanProgress(id, { processed: 2, total: 3, currentTitle: '', statistics: first });
  recordLibraryScanResult(id, { statistics: first, completed: false, remainingCount: 1,
    diagnostics: { directoryErrorCount: 1, fileErrorCount: 0, importedCount: 2 } });
  beginLibraryScanSource(id);
  const second = { ...emptyImportScanStatistics(), unchangedCount: 2 };
  updateLibraryScanProgress(id, { processed: 2, total: 2, currentTitle: '', statistics: second });
  recordLibraryScanResult(id, { statistics: second, diagnostics: { directoryErrorCount: 0, fileErrorCount: 0, importedCount: 0 } });
  completeLibraryScan(id);
  expect(getLibraryScanOperation()).toMatchObject({ source: 'both', status: 'partial', remainingCount: 1,
    progress: { processed: 4, total: 5, statistics: { newCount: 2, unchangedCount: 2, errorCount: 1 } },
    diagnostics: { directoryErrorCount: 1, importedCount: 2 } });
});
test('both-source failures retain their concrete messages even before file enumeration', () => {
  const id = beginLibraryScan(false, 'both');
  recordLibraryScanSourceFailure(id, 'Musikzugriff fehlt');
  beginLibraryScanSource(id); recordLibraryScanSourceFailure(id, 'Ordner fehlt'); completeLibraryScan(id);
  expect(getLibraryScanOperation()).toMatchObject({ status: 'partial', errorMessage: 'Musikzugriff fehlt\nOrdner fehlt' });
});
