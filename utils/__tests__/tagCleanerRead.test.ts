import { readCleanerSnapshot, createCleanerRangeReader } from '../tagCleanerRead';
import { encodeSynchsafe } from '../tagWriterId3';
import { concatBytes } from '../tagWriterBytes';
import type { CleanerReadAdapter } from '../tagCleanerReadTypes';
const text = (value:string) => new TextEncoder().encode(value);
const u32 = (n:number) => new Uint8Array([n>>>24,n>>>16&255,n>>>8&255,n&255]);
const frame = (id:string,bytes:Uint8Array) => concatBytes([text(id),u32(bytes.length),new Uint8Array(2),bytes]);
const id3 = (...frames:Uint8Array[]) => { const body=concatBytes(frames); return concatBytes([new Uint8Array([73,68,51,3,0,0]),encodeSynchsafe(body.length),body,new Uint8Array([255,251,1,2])]); };
const adapter = (bytes:Uint8Array):CleanerReadAdapter => ({info:async()=>({exists:true,size:bytes.length}), range:jest.fn(async(_,p,n)=>bytes.slice(p,p+n))});
const song = (extension='mp3') => ({id:'x',title:'Shown',artist:'Shown',uri:'file:///x.'+extension,fileInfo:{extension}});
const box = (id:string,...parts:Uint8Array[]) => {const body=concatBytes(parts);return concatBytes([u32(body.length+8),new Uint8Array(Array.from(id,c=>c.charCodeAt(0))),body]);};
const item = (id:string,value:string) => box(id,box('data',u32(1),u32(0),text(value)));
test('raw ID3 values are not trimmed, website is separate, and cover/unknown/publisher stay inventoried',async()=>{
  const bytes=id3(frame('TIT2',concatBytes([new Uint8Array([3]),text('  AC/DC  ')])),frame('WXXX',concatBytes([new Uint8Array([0,0]),text('https://pro.beatport.com')])),frame('TPUB',concatBytes([new Uint8Array([0]),text('Beatfreakz Records')])),frame('APIC',new Uint8Array(115294)),frame('TXXX',new Uint8Array([0,1])));
  const io=adapter(bytes); const result=await readCleanerSnapshot(song(),io);
  expect(result).toMatchObject({verified:true,tags:{title:'  AC/DC  '}});
  expect(result.inventory).toContainEqual({id:'WXXX',count:1,values:['https://pro.beatport.com']});
  expect(result.inventory).toContainEqual({id:'TPUB',count:1,values:['Beatfreakz Records']});
  expect((io.range as jest.Mock).mock.calls.some(c=>c[2]>65536)).toBe(false);
});
test.each([new Uint8Array([3,0xff]),new Uint8Array([1,255,254,0]),new Uint8Array([1,255,254,0,216])])('invalid UTF fails closed',async body=>{
 expect((await readCleanerSnapshot(song(),adapter(id3(frame('TIT2',body))))).verified).toBe(false);
});
test('duplicate editable frames and truncated frames fail closed',async()=>{
 const f=frame('TIT2',new Uint8Array([3,65]));
 expect((await readCleanerSnapshot(song(),adapter(id3(f,f)))).verified).toBe(false);
 const bad=id3(f);bad[17]=250;
 expect((await readCleanerSnapshot(song(),adapter(bad))).verified).toBe(false);
});
test('MP4 uses real moov/udta/meta/ilst boxes and ignores mdat fake tag strings',async()=>{
 const bytes=concatBytes([box('ftyp',text('M4A ')),box('mdat',item('\u00a9nam','Fake')),box('moov',box('udta',box('meta',u32(0),box('ilst',item('\u00a9nam','Real'),item('aART','Artist'),box('covr',new Uint8Array(100))))))]);
 expect(await readCleanerSnapshot(song('m4a'),adapter(bytes))).toMatchObject({verified:true,tags:{title:'Real',albumArtist:'Artist'}});
 const nonStandard=concatBytes([box('ftyp',text('M4A ')),box('ilst',item('\u00a9nam','Fake'))]);
 expect((await readCleanerSnapshot(song('m4a'),adapter(nonStandard))).tags).toEqual({});
});
test('read budgets and malformed/unsupported containers fail closed without full reads',async()=>{
 const io=adapter(new Uint8Array(64));
 await expect(createCleanerRangeReader('file:///x',64,io,2).read(0,3)).rejects.toThrow('Lesebudget');
 await expect(createCleanerRangeReader('file:///x',64,io).read(63,2)).rejects.toThrow('Lesebereich');
 const malformed=box('moov',new Uint8Array([1,2]));
 expect((await readCleanerSnapshot(song('mp4'),adapter(malformed))).verified).toBe(false);
 expect((await readCleanerSnapshot(song('flac'),io)).verified).toBe(false);
});
