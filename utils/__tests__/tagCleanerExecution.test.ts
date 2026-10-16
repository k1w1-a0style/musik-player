import { createHash } from 'crypto';
import { executeCleanerBatch } from '../tagCleanerExecution';
import { analyzeCleanerRows } from '../tagCleanerRules';
import { readCleanerSnapshot } from '../tagCleanerRead';
import { concatBytes } from '../tagWriterBytes';
import { encodeSynchsafe } from '../tagWriterId3';
import { mergeId3v23TagIntoMp3Buffer } from '../tagWriterId3';
import { createCleanerSha256, hashCleanerSource } from '../tagCleanerSha256';
import { parseCleanerJournal, saveCleanerJournal, saveCleanerJournalEntry, loadCleanerJournal } from '../tagCleanerJournal';
import { cleanerQueuedSourceReason } from '../tagCleanerPlayback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Song } from '../../types/Song';
import type { CleanerExecutionOptions } from '../tagCleanerExecutionTypes';
import type { CleanerJournal } from '../../types/TagCleaner';
import type { CleanerReadAdapter } from '../tagCleanerReadTypes';
const song=(id='x'):Song=>({id,title:'  Old  ',artist:'Artist',uri:`content://p/document/${id}`,fileInfo:{extension:'mp3',source:'saf'}});
const rows=(songs:Song[])=>analyzeCleanerRows(songs,songs.map(s=>({verified:true,tags:{title:s.title,artist:s.artist},inventory:[]})));
const options=(songs:Song[],extras:Partial<CleanerExecutionOptions>={}):CleanerExecutionOptions=>({mode:'display',getSongs:()=>songs,cancelled:()=>false,updateSong:jest.fn(async()=>undefined),saveJournal:jest.fn(async()=>undefined),...extras});
test('display success waits for durable ACK, cancellation is between files, and raw file tags are not rewritten',async()=>{
 const songs=[song('a'),song('b')];let cancel=false;let resolve!:()=>void;
 const update=jest.fn(()=>new Promise<void>(done=>{resolve=done;}));const saves=jest.fn(async(_journal:CleanerJournal)=>undefined);
 const pending=executeCleanerBatch({rows:rows(songs),options:options(songs,{updateSong:update,saveJournal:saves,cancelled:()=>cancel})});
 await new Promise(done=>setTimeout(done,0));
 await expect(executeCleanerBatch({rows:rows(songs),options:options(songs)})).rejects.toThrow('bereits aktiv');
 expect(update).toHaveBeenCalledTimes(1);expect(saves.mock.calls.at(-1)![0].entries[0].status).toBe('pending');
 cancel=true;resolve();const result=await pending;
 expect(result.entries.map(e=>e.status)).toEqual(['displayed','skipped']);expect(update).toHaveBeenCalledTimes(1);
});
test('void ACK and persistence rejection never report displayed; user corrections since preview are preserved',async()=>{
 const songs=[song()];
 const bad=options(songs,{updateSong:jest.fn(()=>undefined as unknown as Promise<void>)});
 expect((await executeCleanerBatch({rows:rows(songs),options:bad})).entries[0]).toMatchObject({status:'failed',error:expect.stringContaining('ACK')});
 const reject=options(songs,{updateSong:jest.fn(async()=>{throw new Error('Disk full');})});
 expect((await executeCleanerBatch({rows:rows(songs),options:reject})).entries[0]).toMatchObject({status:'failed'});
 const originalRows=rows(songs);songs[0]={...songs[0],title:'User correction'};const update=jest.fn(async()=>undefined);
 expect((await executeCleanerBatch({rows:originalRows,options:options(songs,{updateSong:update})})).entries[0].status).toBe('skipped');expect(update).not.toHaveBeenCalled();
});
const rawFrame=(id:string,value:string)=>{const body=concatBytes([new Uint8Array([3]),new TextEncoder().encode(value)]);return concatBytes([new TextEncoder().encode(id),new Uint8Array([0,0,body.length>>>8,body.length&255,0,0]),body]);};
const fixture=async()=>{
 const songs=[song()];const body=concatBytes([rawFrame('TIT2','  Old  '),rawFrame('TPE1','Artist')]);let bytes=concatBytes([new Uint8Array([73,68,51,3,0,0]),encodeSynchsafe(body.length),body,new Uint8Array([255,251,17,18,19])]);
 const io:CleanerReadAdapter={info:async()=>({exists:true,size:bytes.length,modificationTime:1}),range:async(_,p,n)=>bytes.slice(p,p+n)};
 const snapshot=await readCleanerSnapshot(songs[0],io);const fileRows=analyzeCleanerRows(songs,[snapshot],undefined,'file');fileRows[0].writable=true;
 return {songs,io,fileRows,getBytes:()=>bytes,setBytes:(next:Uint8Array)=>{bytes=next;}};
};
test('file CAS is computed only for selected files, raw-before is rechecked, successful readback patches hash/stat after native confirmation',async()=>{
 const f=await fixture();const audio=f.getBytes().slice(-5);const update=jest.fn(async()=>undefined);
 const write=jest.fn(async(s,d,o)=>{expect(o.expectedOriginalSizeBytes).toBe(f.getBytes().length);expect(o.expectedOriginalSha256Hex).toMatch(/^[a-f0-9]{64}$/);expect(await o.preflight()).toBeUndefined();f.setBytes(mergeId3v23TagIntoMp3Buffer(f.getBytes(),d));return {status:'written' as const,warnings:[],terminal:true,operationStatus:'completed' as const};});
 const journal=await executeCleanerBatch({rows:f.fileRows,options:options(f.songs,{mode:'file',readAdapter:f.io,queueReason:async()=>undefined,write,updateSong:update})});
 expect(journal.entries[0].status).toBe('written');expect(update).toHaveBeenCalledWith('x',expect.objectContaining({title:'Old',fileInfo:expect.objectContaining({size:f.getBytes().length,contentHash:expect.stringMatching(/^[a-f0-9]{64}$/)})}));
 expect(f.getBytes().slice(-5)).toEqual(audio);
});
test('raw-before source change and read-only formats skip without a writer',async()=>{
 const f=await fixture();f.setBytes(mergeId3v23TagIntoMp3Buffer(f.getBytes(),{songId:'x',tags:{title:'External'}}));const write=jest.fn();
 expect((await executeCleanerBatch({rows:f.fileRows,options:options(f.songs,{mode:'file',readAdapter:f.io,write})})).entries[0].status).toBe('skipped');expect(write).not.toHaveBeenCalled();
 f.fileRows[0].writable=false;
 expect((await executeCleanerBatch({rows:f.fileRows,options:options(f.songs,{mode:'file',readAdapter:f.io,write})})).entries[0].status).toBe('skipped');
});
test('queued native auto-next source and unconfirmed queue source fail closed',()=>{
 const songs=[song('a'),song('b')];
 expect(cleanerQueuedSourceReason(songs[1],[{id:'a',url:songs[0].uri},{id:'b',url:'file:///converted/b'}],songs)).toMatch(/Warteschlange/);
 expect(cleanerQueuedSourceReason(songs[1],[{id:'a',url:undefined}],songs)).toMatch(/unbestätigte/);
 expect(cleanerQueuedSourceReason(songs[1],[],songs)).toBeUndefined();
});
test('native pending or failure stops the batch and cannot patch metadata',async()=>{
 const f=await fixture();const update=jest.fn(async()=>undefined);let called=0;
 const write=jest.fn(async()=>{called++;return {status:'writeFailed' as const,warnings:[],terminal:false,operationStatus:'pending' as const,operationId:'native-pending'};});
 const result=await executeCleanerBatch({rows:[...f.fileRows,{...f.fileRows[0],song:song('later')}],options:options([...f.songs,song('later')],{mode:'file',readAdapter:f.io,write,queueReason:async()=>undefined,updateSong:update})});
 expect(result.entries.map(e=>e.status)).toEqual(['pending','skipped']);expect(called).toBe(1);expect(update).not.toHaveBeenCalled();
});
test('SHA-256 standard vectors, bounded64KiBstream, max50MiB and changed stat are verified',async()=>{
 const sha=createCleanerSha256();sha.update(new TextEncoder().encode('a'));sha.update(new TextEncoder().encode('bc'));expect(sha.digest()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 const empty=createCleanerSha256();expect(empty.digest()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
 const bytes=new Uint8Array(131073).fill(65);const read=jest.fn(async(_,p,n)=>bytes.slice(p,p+n));
 expect((await hashCleanerSource('file:///x',{info:async()=>({exists:true,size:bytes.length}),range:read})).sha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(read.mock.calls.map(c=>c[2])).toEqual([65536,65536,1]);
 const noRead=jest.fn();await expect(hashCleanerSource('x',{info:async()=>({exists:true,size:50*1024*1024+1}),range:noRead})).rejects.toThrow('50-MiB');expect(noRead).not.toHaveBeenCalled();
 let stat=0;await expect(hashCleanerSource('x',{info:async()=>({exists:true,size:1,modificationTime:++stat}),range:async()=>new Uint8Array(1)})).rejects.toThrow('während');
});
test('journal saves readback, rejects malformed/oversized journals and recovers as interrupted without repeat',async()=>{
 await AsyncStorage.clear();const result=await executeCleanerBatch({rows:rows([song()]),options:options([song()])});result.entries[0].status='pending';await saveCleanerJournal(result);
 expect((await loadCleanerJournal())!.entries[0].status).toBe('interrupted');
 expect(()=>parseCleanerJournal('{"version":1}')).toThrow('ungültig');expect(()=>parseCleanerJournal('x'.repeat(4*1024*1024+1))).toThrow('Größenlimit');
 const originalGet=(AsyncStorage.getItem as jest.Mock).getMockImplementation();const get=jest.spyOn(AsyncStorage,'getItem').mockResolvedValueOnce(JSON.stringify(result)).mockResolvedValueOnce('mismatch');await expect(saveCleanerJournal(result)).rejects.toThrow('nicht bestätigt');get.mockRestore();(AsyncStorage.getItem as jest.Mock).mockImplementation(originalGet);
});

test('journal storage bytes grow linearly and records from older epochs cannot replace a current run',async()=>{
 await AsyncStorage.clear();
 const inputs=Array.from({length:40},(_,i)=>song(String(i)));
 const originalSet=(AsyncStorage.setItem as jest.Mock).getMockImplementation();
 (AsyncStorage.setItem as jest.Mock).mockClear();const writes=jest.spyOn(AsyncStorage,'setItem');
 const journal=await executeCleanerBatch({rows:rows(inputs),options:{...options(inputs),saveJournal:undefined}});
 const bytes=writes.mock.calls.reduce((sum,[,raw])=>sum+raw.length,0);
 expect(writes).toHaveBeenCalledTimes(82);
 expect(bytes).toBeLessThan(JSON.stringify(journal).length*8);
 const old={...journal,id:'older'};await expect(saveCleanerJournalEntry(old,0)).rejects.toThrow('abgelöst');
 expect((await loadCleanerJournal())!.entries.every(e=>e.status==='displayed')).toBe(true);writes.mockRestore();(AsyncStorage.setItem as jest.Mock).mockImplementation(originalSet);
});

test('retention awaits deletion and keeps the active-batch guard until storage work settles',async()=>{
 await AsyncStorage.clear();
 const old:CleanerJournal={version:1,id:'retention-before-batch',createdAt:1,entries:[{songId:'old',sourceKey:'synthetic',before:{},after:{},mode:'display',status:'displayed'}]};
 await saveCleanerJournal(old);await saveCleanerJournalEntry(old,0);
 const remove=(AsyncStorage.multiRemove as jest.Mock).getMockImplementation();
 if(!remove) throw new Error('Storage mock implementation missing');
 let finish!:()=>void;
 (AsyncStorage.multiRemove as jest.Mock).mockImplementationOnce((keys:string[])=>new Promise<void>(resolve=>{finish=()=>{void remove(keys).then(resolve);};}));
 const inputs=[song('retention-next')];const update=jest.fn(async()=>undefined);
 const pending=executeCleanerBatch({rows:rows(inputs),options:{...options(inputs,{updateSong:update}),saveJournal:undefined}});
 await new Promise(done=>setTimeout(done,0));
 expect(update).not.toHaveBeenCalled();
 await expect(executeCleanerBatch({rows:rows(inputs),options:options(inputs)})).rejects.toThrow('bereits aktiv');
 finish();expect((await pending).entries[0].status).toBe('displayed');
 expect(update).toHaveBeenCalledTimes(1);
});
