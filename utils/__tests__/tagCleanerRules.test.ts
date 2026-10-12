import { analyzeCleanerRows } from '../tagCleanerRules';
import { DEFAULT_CLEANER_RULES, cleanerNumber } from '../tagCleanerFieldRules';
import { cleanerReferenceRows } from './tagCleanerReferenceFixture';
import type { Song } from '../../types/Song';
import type { CleanerSnapshot } from '../../types/TagCleaner';
const songs: Song[] = cleanerReferenceRows.map((r,i) => ({ id: String(i), title: r.Titel_TIT2, artist: r.Interpret_TPE1, albumArtist: r.Albuminterpret_TPE2, album: r.Album_TALB, trackNumber: r.Track_TRCK, discNumber: r.Disk_TPOS, year: r.Jahr_TDRC, genre: r.Genre_TCON, uri: `file:///Music/${r.Albumordner}/${r.Dateiname}`, fileInfo: {filename: r.Dateiname, extension:'mp3'} }));
const snapshots: CleanerSnapshot[] = songs.map((s,i) => ({verified: true, tags: {title:s.title,artist:s.artist,albumArtist:s.albumArtist,album:s.album,trackNumber:s.trackNumber,discNumber:s.discNumber,year:s.year,genre:s.genre}, inventory: [{id:'APIC',count:1},...(cleanerReferenceRows[i].Website_WXXX ? [{id:'WXXX',count:1,values:[cleanerReferenceRows[i].Website_WXXX]}] : [{id:'TPUB',count:1,values:['Beatfreakz Records']}])] }));
test('CSV21: Osmik clean, one minor artist case proposal and one folder hint; no majority conflicts', () => {
  const rows = analyzeCleanerRows(songs, snapshots);
  expect(rows.slice(13).every(row => row.changes.length === 0)).toBe(true);
  expect(rows.flatMap(row => row.changes).map(c => [c.field,c.before,c.after])).toEqual([['folder','fant4tik - Reptilians','fant4stik - Reptilians'],['artist','Fant4stik','fant4stik']]);
  expect(rows[4].changes[0]).toMatchObject({confidence:'review',selected:false});
  expect(rows[0].notes.join(' ')).toContain('WXXX');
});
test('Bass Weapon rename preserves extension and remains preview/export only', () => {
  const rows = analyzeCleanerRows(songs, snapshots, {...DEFAULT_CLEANER_RULES,filenames:true,privateUrls:true});
  expect(rows[7].changes).toContainEqual(expect.objectContaining({field:'filename',after:'08 - fant4stik - Bass Weapon.mp3',previewOnly:true,selected:false}));
  expect(rows[0].changes).toContainEqual(expect.objectContaining({field:'website',before:'https://pro.beatport.com',previewOnly:true,selected:false}));
});
test('safe field rules preserve punctuation, Remix/Live, metadata authority and use exact terminal URL boundaries', () => {
  const song: Song = {id:'x',title:'  AC/DC  (Live) - www.soundcloud.com/a ',artist:"Funk'n'Stein",genre:'Hardtek / Tribecore',fileInfo:{filename:'99 - Wrong - Incorrect.mp3'}};
  const row = analyzeCleanerRows([song],[{tags:{},inventory:[],verified:false}])[0];
  expect(row.changes).toEqual([expect.objectContaining({field:'title',after:'AC/DC (Live)',confidence:'review'})]);
  const second = analyzeCleanerRows([{...song,title:'AC/DC (Live)'}],[{tags:{title:song.title},inventory:[],verified:true}])[0];
  expect(second.changes).toHaveLength(0);
});
test('no unsafe numeric overflow or Infinity, and canonical numbers are idempotent', () => {
  expect(cleanerNumber('01 / 013')).toBe('1/13');
  for (const bad of ['0','99/2','Infinity','9'.repeat(400),'9007199254740993']) expect(cleanerNumber(bad)).toBe(bad);
});
test('compilation artist names and two equally plausible spellings are preserved', () => {
  const inputs = [{id:'a',title:'X',artist:'DJ One',albumArtist:'VA',album:'Sampler'}, {id:'b',title:'Y',artist:'DJ Two',albumArtist:'VA',album:'Sampler'}, {id:'c',title:'Z',artist:'dj one',albumArtist:'VA',album:'Sampler'}];
  const rows = analyzeCleanerRows(inputs,inputs.map(s => ({tags:s,inventory:[],verified:true})));
  expect(rows.every(row => row.changes.length === 0)).toBe(true);
});

test('default cleaner preserves multiline comments and lyrics-like content',()=>{
 const input:Song={id:'comment',title:'Title',artist:'Artist',comment:' first\nsecond  line '};
 expect(analyzeCleanerRows([input],[{tags:{},verified:false,inventory:[]}])[0].changes).toEqual([]);
});
