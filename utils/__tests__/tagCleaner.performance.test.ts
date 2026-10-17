import {analyzeCleanerRows} from '../tagCleanerRules';
import {restrictCleanerFields,selectSafeCleanerChanges} from '../tagCleanerModel';
import {uniqueCleanerSongs} from '../tagCleanerSelection';
test.each([1000,5000,10000])('Cleaner model handles %i unique songs with exact visible scope',count=>{
 const songs=Array.from({length:count},(_,index)=>({id:String(index),title:`  Titel ${index} `,artist:'Artist',album:`Album ${index%30}`,uri:`file:///Music/${index}.mp3`}));
 const snapshots=songs.map(()=>({tags:{},inventory:[],verified:false}));
 const start=performance.now();
 const unique=uniqueCleanerSongs(songs);
 const rows=restrictCleanerFields(analyzeCleanerRows(unique,snapshots),['title']);
 const analyzed=performance.now();
 const selected=selectSafeCleanerChanges(rows,songs.slice(0,50).map(song=>song.id));
 const end=performance.now();
 expect(rows).toHaveLength(count);expect(selected[0].changes[0].after).toBe('Titel 0');
 expect(selected[50]).toBe(rows[50]);
 // eslint-disable-next-line no-console -- Reproducible host model timing, no device FPS/IO claim.
 console.info(JSON.stringify({scope:'Cleaner host JavaScript; synthetic snapshots; no native IO',songs:count,analyzeMs:analyzed-start,selectMs:end-analyzed}));
},30000);
