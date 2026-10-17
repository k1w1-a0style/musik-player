import { analyzeCleanerRows, selectedCleanerTags } from '../tagCleanerRules';
import { restrictCleanerFields, selectSafeCleanerChanges } from '../tagCleanerModel';
import { DEFAULT_CLEANER_RULES } from '../tagCleanerFieldRules';
const rows=()=>analyzeCleanerRows(['a','b'].map(id=>({id,title:'  Titel ',artist:'Artist',year:' 2026 '})),['a','b'].map(()=>({tags:{title:'  Titel ',year:' 2026 '},inventory:[],verified:true})),DEFAULT_CLEANER_RULES,'file');
test('visible safe selection leaves hidden changes untouched; global selection is explicit',()=>{
 const unselected=rows().map(row=>({...row,changes:row.changes.map(change=>({...change,selected:false}))}));
 const visible=selectSafeCleanerChanges(unselected,['a']);
 expect(selectedCleanerTags(visible[0])).toEqual({title:'Titel',year:'2026'});
 expect(selectedCleanerTags(visible[1])).toEqual({});
 expect(selectedCleanerTags(selectSafeCleanerChanges(visible)[1])).toEqual({title:'Titel',year:'2026'});
});
test('global field restriction removes year from preview and from exact writer tags',()=>{
 for(const row of restrictCleanerFields(rows(),['title'])) expect(selectedCleanerTags(row)).toEqual({title:'Titel'});
});

test('blocked fields cannot leave a false proposal/conflict status behind',()=>{
 const original=analyzeCleanerRows([{id:'a',title:'Titel',artist:'Artist',year:' 2026 '}],[{tags:{},inventory:[],verified:false}]);
 expect(original[0].status).toBe('proposal');
 const [restricted]=restrictCleanerFields(original,['title']);
 expect(restricted.changes).toEqual([]);expect(restricted.status).toBe('clean');
});
