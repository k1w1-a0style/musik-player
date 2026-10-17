import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '../types/Song';
import type { CleanerJournal, CleanerMode, CleanerRow, CleanerRules, CleanerSnapshot, CleanerField, CleanerProcess } from '../types/TagCleaner';
import { uniqueCleanerSongs } from '../utils/tagCleanerSelection';
import { readCleanerSnapshot } from '../utils/tagCleanerRead';
import { analyzeCleanerRows } from '../utils/tagCleanerRules';
import { DEFAULT_CLEANER_RULES, THOROUGH_CLEANER_RULES, CLEANER_FIELDS } from '../utils/tagCleanerFieldRules';
import { executeCleanerBatch } from '../utils/tagCleanerExecution';
import { loadCleanerJournal } from '../utils/tagCleanerJournal';
import { advanceCleanerProcess, finishCleanerProcess, restrictCleanerFields, selectSafeCleanerChanges } from '../utils/tagCleanerModel';
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
  const [process,setProcess]=useState<CleanerProcess>({phase:'idle',completed:0,total:0,confirmed:0,failed:0,cancelRequested:false,recoveryPending:false});
  const [fields,setFields]=useState<CleanerField[]>(CLEANER_FIELDS.filter(field=>field!=='comment'));
  const [error,setError]=useState('');
  const songsRef=useRef(songs);songsRef.current=songs;
  const cancelled=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;void loadCleanerJournal().then(saved=>{if(mounted.current){setJournal(saved);setJournalReady(true);}}).catch(e=>{if(mounted.current)setError(String(e));});return()=>{mounted.current=false;cancelled.current=true;};},[]);
  const select=useCallback((next:string[])=>{if(busyRef.current)return;setIds(next);setRows([]);setStage('rules');setError('');},[]);
  const configure=useCallback((next:Partial<CleanerRules>)=>{if(busyRef.current)return;setRules(current=>({...current,...next}));setRows([]);setStage('rules');},[]);
  const profile=useCallback((thorough:boolean)=>{if(busyRef.current)return;setRules({...thorough ? THOROUGH_CLEANER_RULES : DEFAULT_CLEANER_RULES});setRows([]);setStage('rules');},[]);
  const changeMode=useCallback((next:CleanerMode)=>{if(busyRef.current)return;setMode(next);setRows([]);setStage('rules');},[]);
  const analyze=useCallback(async()=>{
    if(busyRef.current)return;
    busyRef.current=true;setBusy(true);setError('');cancelled.current=false;
    const targets=uniqueCleanerSongs(songsRef.current,ids ?? []);
    const snapshots:CleanerSnapshot[]=[];
    setProcess({operation:'analysis',phase:'reading',completed:0,total:targets.length,confirmed:0,failed:0,cancelRequested:false,recoveryPending:false,startedAt:Date.now()});
    try {
      for(let index=0;index<targets.length;index+=1){
        if(cancelled.current)break;
        if(mounted.current)setProcess(current=>({...current,currentDisplayLabel:targets[index].title}));
        snapshots.push(await readCleanerSnapshot(targets[index]));
        if(mounted.current)setProcess(current=>({...current,completed:snapshots.length,currentDisplayLabel:targets[index].title}));
        await new Promise<void>(resolve=>setTimeout(resolve,0));
      }
      if(mounted.current){setRows(restrictCleanerFields(analyzeCleanerRows(targets.slice(0,snapshots.length),snapshots,rules,mode),fields,mode));setProcess(current=>({...current,phase:cancelled.current?'cancelled':'complete',currentDisplayLabel:undefined}));setStage('preview');}
    }catch(e){if(mounted.current){setError(String(e));setProcess(current=>({...current,phase:'failed'}));}}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);}}
  },[ids,rules,mode,fields]);
  const changeRow=useCallback((songId:string,index:number,patch:Partial<CleanerRow['changes'][number]>)=>{
    if(busyRef.current)return;
    setRows(current=>current.map(row=>row.song.id===songId ? {...row,changes:row.changes.map((change,i)=>i===index ? {...change,...patch} : change)} : row));
  },[]);
  const selectSafe=useCallback((visibleIds?:readonly string[])=>{if(!busyRef.current)setRows(current=>selectSafeCleanerChanges(current,visibleIds));},[]);
  const changeFields=useCallback((next:CleanerField[])=>{if(busyRef.current)return;setFields(next);setRows([]);setStage('rules');},[]);
  const apply=useCallback(async(confirmedRows:CleanerRow[]=rows)=>{
    if(busyRef.current)return;
    if(!journalReady){setError('Cleaner-Journal noch nicht bestätigt geladen.');return;}
    if(!updateSong){setError('Bestätigte Bibliothek-Persistenz ist nicht verfügbar.');return;}
    busyRef.current=true;cancelled.current=false;setBusy(true);setError('');
    setProcess({operation:'apply',phase:'applying',completed:0,total:confirmedRows.filter(row=>row.changes.some(change=>change.selected&&!change.previewOnly)).length,confirmed:0,failed:0,cancelRequested:false,recoveryPending:false,startedAt:Date.now()});
    try {
      const result=await executeCleanerBatch({rows:confirmedRows,options:{mode,getSongs:()=>songsRef.current,cancelled:()=>cancelled.current,updateSong,
        onProgress:(finished,total,currentJournal)=>{if(mounted.current){setProcess(current=>advanceCleanerProcess(current,finished,total,currentJournal));}},
      }});
      if(mounted.current){setJournal(result);setProcess(current=>finishCleanerProcess(current,result,cancelled.current));setStage('result');}
    }catch(e){if(mounted.current){setError(String(e));setProcess(current=>({...current,phase:'failed'}));}}
    finally{busyRef.current=false;if(mounted.current){setBusy(false);}}
  },[journalReady,updateSong,rows,mode]);
  const exportReport=useCallback(async()=>{try{const uri=await exportCleanerReport(rows,journal);if(uri)setError('Bericht exportiert und geprüft.');}catch(e){setError(String(e));}},[rows,journal]);
  return {ids,rules,fields,changeFields,mode,rows,journal,stage,busy,process,error,select,configure,profile,changeMode,analyze,changeRow,selectSafe,apply,exportReport,
    cancel:()=>{cancelled.current=true;setProcess(current=>({...current,cancelRequested:true}));},
    showLastResult:()=>{if(!busyRef.current&&journal)setStage('result');},
    chooseAgain:()=>{if(busyRef.current)return;setStage('selection');setRows([]);},
  };
};
