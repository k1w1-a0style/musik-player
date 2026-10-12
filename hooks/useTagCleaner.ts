import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import type { CleanerJournal, CleanerMode, CleanerRow, CleanerRules, CleanerSnapshot } from '../types/TagCleaner';
import { uniqueCleanerSongs } from '../utils/tagCleanerSelection';
import { readCleanerSnapshot } from '../utils/tagCleanerRead';
import { analyzeCleanerRows } from '../utils/tagCleanerRules';
import { DEFAULT_CLEANER_RULES, THOROUGH_CLEANER_RULES } from '../utils/tagCleanerFieldRules';
import { executeCleanerBatch } from '../utils/tagCleanerExecution';
import { loadCleanerJournal } from '../utils/tagCleanerJournal';
import { exportCleanerReport } from '../utils/tagCleanerReport';
export const useTagCleaner = (songs: Song[], initialIds: string[] | undefined, updateSong?: (id:string,patch:Partial<Song>)=>Promise<void>) => {
  const [ids,setIds]=useState<string[]|undefined>(initialIds);
  const [rules,setRules]=useState<CleanerRules>({...DEFAULT_CLEANER_RULES});
  const [mode,setMode]=useState<CleanerMode>('display');
  const [rows,setRows]=useState<CleanerRow[]>([]);
  const [journal,setJournal]=useState<CleanerJournal>();
  const [stage,setStage]=useState<'selection'|'rules'|'preview'|'result'>(initialIds ? 'rules' : 'selection');
  const [busy,setBusy]=useState(false);
  const [journalReady,setJournalReady]=useState(false);
  const busyRef=useRef(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const songsRef=useRef(songs);songsRef.current=songs;
  const cancelled=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;void loadCleanerJournal().then(saved=>{if(mounted.current){setJournal(saved);setJournalReady(true);}}).catch(e=>{if(mounted.current)setError(String(e));});return()=>{mounted.current=false;cancelled.current=true;};},[]);
  const select=useCallback((next:string[])=>{setIds(next);setRows([]);setStage('rules');setError('');},[]);
  const configure=useCallback((next:Partial<CleanerRules>)=>{setRules(current=>({...current,...next}));setRows([]);setStage('rules');},[]);
  const profile=useCallback((thorough:boolean)=>{setRules({...thorough ? THOROUGH_CLEANER_RULES : DEFAULT_CLEANER_RULES});setRows([]);setStage('rules');},[]);
  const changeMode=useCallback((next:CleanerMode)=>{setMode(next);setRows([]);setStage('rules');},[]);
  const analyze=useCallback(async()=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setError('');cancelled.current=false;
    const targets=uniqueCleanerSongs(songsRef.current,ids ?? []);
    const snapshots:CleanerSnapshot[]=[];
    try {
      for(let index=0;index<targets.length;index+=1){
        if(cancelled.current)break;
        setProgress(`Lesen ${index+1} / ${targets.length}`);
        snapshots.push(await readCleanerSnapshot(targets[index]));
        await new Promise<void>(resolve=>setTimeout(resolve,0));
      }
      if(mounted.current){setRows(analyzeCleanerRows(targets.slice(0,snapshots.length),snapshots,rules,mode));setStage('preview');}
    }catch(e){if(mounted.current)setError(String(e));}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);setProgress('');}}
  },[ids,rules,mode]);
  const changeRow=useCallback((songId:string,index:number,patch:Partial<CleanerRow['changes'][number]>)=>{
    setRows(current=>current.map(row=>row.song.id===songId ? {...row,changes:row.changes.map((change,i)=>i===index ? {...change,...patch} : change)} : row));
  },[]);
  const selectSafe=useCallback(()=>{setRows(current=>current.map(row=>({...row,changes:row.changes.map(change=>({...change,selected:change.confidence==='safe'&&!change.previewOnly}))})));},[]);
  const apply=useCallback(async()=>{
    if(busyRef.current)return;
    if(!journalReady){setError('Cleaner-Journal noch nicht bestätigt geladen.');return;}
    if(!updateSong){setError('Bestätigte Bibliothek-Persistenz ist nicht verfügbar.');return;}
    busyRef.current=true;cancelled.current=false;setBusy(true);setError('');
    try {
      const result=await executeCleanerBatch({rows,options:{mode,getSongs:()=>songsRef.current,cancelled:()=>cancelled.current,updateSong,
        onProgress:(finished,total)=>{if(mounted.current){setProgress(`Anwenden ${finished} / ${total}`);}},
      }});
      if(mounted.current){setJournal(result);setStage('result');}
    }catch(e){if(mounted.current)setError(String(e));}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);setProgress('');}}
  },[journalReady,updateSong,rows,mode]);
  const exportReport=useCallback(async()=>{try{const uri=await exportCleanerReport(rows,journal);if(uri)setError('Bericht exportiert und geprüft.');}catch(e){setError(String(e));}},[rows,journal]);
  return {ids,rules,mode,rows,journal,stage,busy,progress,error,select,configure,profile,changeMode,analyze,changeRow,selectSafe,apply,exportReport,
    cancel:()=>{cancelled.current=true;setProgress('Abbruch vorgemerkt; laufende Datei wird geordnet abgeschlossen.');},
    chooseAgain:()=>{setStage('selection');setRows([]);},
  };
};
