import * as FileSystem from 'expo-file-system/legacy';
import type { CleanerJournal, CleanerRow } from '../types/TagCleaner';
export const cleanerReport = (rows: readonly CleanerRow[], journal?: CleanerJournal): string => JSON.stringify({
  version:1,createdAt:new Date().toISOString(),
  safety:'Dateinamen, Ordner und Website-Löschungen sind nur Exportvorschläge. Kein Undo: native COMMITTED-Originalbackups werden bereinigt.',
  rows:rows.map(row=>({songId:row.song.id,sourceKey:row.sourceKey,status:row.status,rawFileVerified:row.original.verified,
    rawFileBefore:row.original.tags,displayBefore:row.displayBefore,changes:row.changes,inventory:row.original.inventory,notes:row.notes})),journal,
},null,2);
export const exportCleanerReport = async (rows: readonly CleanerRow[], journal?: CleanerJournal): Promise<string | undefined> => {
  const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!access.granted) return undefined;
  const raw = cleanerReport(rows,journal);
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(access.directoryUri,`Tag-Cleaner-${Date.now()}.json`,'application/json');
  await FileSystem.writeAsStringAsync(uri,raw,{encoding:FileSystem.EncodingType.UTF8});
  const saved = await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.UTF8});
  if (saved !== raw) throw new Error('Export wurde nicht bestätigt gelesen.');
  return uri;
};
