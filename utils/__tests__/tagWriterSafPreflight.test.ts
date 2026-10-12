import type { Song } from '../../types/Song';
const song:Song={id:'x',title:'Old',artist:'Artist',uri:'content://p/document/x',fileInfo:{source:'saf',extension:'mp3'}};
const draft={songId:'x',tags:{title:'New'}};
const load=()=>{
 jest.resetModules();
 const write=jest.fn(async(uri:string,request:{operationId:string})=>({success:true,verified:true,uri,operationId:request.operationId,phase:'COMPLETED',terminal:true,retryable:false,changedFields:['title'],failedFields:[]}));
 const native={hasNativeTagWriter:true,writeAudioTags:write,getAudioTagRecoveryStatus:jest.fn(async()=>({available:true,pendingCount:0,retainedOutcomeCount:0,transactions:[]})),recoverPendingAudioTagTransactions:jest.fn(async()=>({success:true,recoveryPending:false}))};
 jest.doMock('expo-system-audio',()=>({__esModule:true,default:native}));
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const api=require('../tagWriterPublicApi') as typeof import('../tagWriterPublicApi');
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const locks=require('../tagWriterLocks') as typeof import('../tagWriterLocks');
 return {...api,locks,write};
};
afterEach(()=>{jest.dontMock('expo-system-audio');jest.resetModules();jest.clearAllMocks();});
test('preflight sees reserved owner and rejects before native call',async()=>{
 const {writeTagsToFile,write,locks}=load();
 const preflight=jest.fn(async()=>{expect(locks.getActiveSafWrite(song.uri!)).toBeDefined();return 'Queued source';});
 expect(await writeTagsToFile(song,draft,{operationId:'reserved-test',preflight})).toMatchObject({errorCode:'TransactionConflict',errorMessage:'Queued source',terminal:true});
 expect(preflight).toHaveBeenCalledTimes(1);expect(write).not.toHaveBeenCalled();
});
test('source CAS reaches native untouched, while legacy editor requests remain supported',async()=>{
 const {writeTagsToFile,write}=load(); const hash='a'.repeat(64);
 expect((await writeTagsToFile(song,draft,{expectedOriginalSizeBytes:100,expectedOriginalSha256Hex:hash,preflight:async()=>undefined})).status).toBe('written');
 expect(write).toHaveBeenCalledWith(song.uri,expect.objectContaining({expectedOriginalSizeBytes:100,expectedOriginalSha256Hex:hash}));
 expect((await writeTagsToFile(song,draft)).status).toBe('written');
});
test('malformed CAS or failed preflight cannot reach native writer',async()=>{
 const {writeTagsToFile,write}=load();
 expect((await writeTagsToFile(song,draft,{expectedOriginalSizeBytes:Infinity,expectedOriginalSha256Hex:'x'})).errorCode).toBe('InvalidTagData');
 expect((await writeTagsToFile(song,draft,{preflight:async()=>{throw new Error('Queue unreadable');}})).status).toBe('writeFailed');
 expect(write).not.toHaveBeenCalled();
});
