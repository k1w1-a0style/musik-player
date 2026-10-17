import React from 'react';
import { render,fireEvent } from '@testing-library/react-native';
import { TagCleanerChooser } from '../TagCleanerChooser';
import { TagCleanerPreview } from '../TagCleanerPreview';
import { TagCleanerResult } from '../TagCleanerResult';
import { getAppTheme } from '../../utils/appTheme';
import { analyzeCleanerRows } from '../../utils/tagCleanerRules';
const mockTheme=getAppTheme('dark','graphite');
jest.mock('../../contexts/AppThemeContext',()=>({useAppTheme:()=>({theme:mockTheme})}));
const songs=[{id:'a',title:'  First ',artist:'Artist',album:'A'},{id:'b',title:'  Second ',artist:'Artist',album:'B'}];
test('search and source-tab changes retain the combined unique song selection',()=>{
 const select=jest.fn();const view=render(<TagCleanerChooser songs={songs} playlists={[]} folders={[]} onSelect={select}/>);
 fireEvent.changeText(view.getByLabelText('Musikauswahl durchsuchen'),'First');
 fireEvent.press(view.getByText(/☐.*First/));
 fireEvent.press(view.getByText('Alben'));
 fireEvent.press(view.getByText(/☐ B ·/));
 fireEvent.press(view.getByText(/2 eindeutige Titel · Weiter/));
 expect(select).toHaveBeenCalledWith(['a','b']);
});
test('filtered safe action passes only visible ids, global action passes no hidden scope',()=>{
 const safe=jest.fn();const rows=analyzeCleanerRows(songs,songs.map(()=>({tags:{},inventory:[],verified:false})));
 const view=render(<TagCleanerPreview rows={rows} busy={false} onChange={jest.fn()} onSafe={safe} onApply={jest.fn()} onExport={jest.fn()} onRules={jest.fn()}/>);
 fireEvent.press(view.getByTestId('tag-cleaner-filters'));
 fireEvent.changeText(view.getByLabelText('Albumfilter'),'A');
 fireEvent.press(view.getByTestId('tag-cleaner-tools'));
 fireEvent.press(view.getByTestId('tag-cleaner-select-safe'));
 expect(safe).toHaveBeenLastCalledWith(['a']);
 fireEvent.press(view.getByTestId('tag-cleaner-select-safe-all'));
 expect(safe).toHaveBeenLastCalledWith();
 expect(view.getByText('Sichtbar: 1 · Insgesamt ausgewählt: 2 · Außerhalb Filter: 1')).toBeTruthy();
});
test('result virtualizes ten thousand entries and never calls a completed native write fully confirmed after library failure',()=>{
 const entries=Array.from({length:10000},(_,index)=>({songId:String(index),sourceKey:'content://'+index,before:{title:'Titel '+index},after:{title:'Neu '+index},mode:'file' as const,status:'failed' as const,operationId:'op',writeResult:{status:'written',operationStatus:'completed',terminal:true} as any}));
 const view=render(<TagCleanerResult rows={[]} journal={{version:1,id:'test',createdAt:1,entries}} onChoose={jest.fn()} onExport={jest.fn()}/>);
 expect(view.getByTestId('tag-cleaner-result-list').props.data).toHaveLength(10000);
 expect(view.getAllByText('Datei geändert – Anzeige nicht bestätigt').length).toBeLessThan(100);
});
test('result accounts for analyzed proposals that were not approved',()=>{
 const rows=analyzeCleanerRows(songs,songs.map(()=>({tags:{},inventory:[],verified:false})));
 rows[1].changes.forEach(change=>{change.selected=false;});
 const view=render(<TagCleanerResult rows={rows} journal={{version:1,id:'subset',createdAt:1,entries:[{songId:'a',sourceKey:'id:a',before:{title:'  First '},after:{title:'First'},mode:'display',status:'displayed'}]}} onChoose={jest.fn()} onExport={jest.fn()}/>);
 expect(view.getByText('1 Titel ohne Freigabe · 0 Titel mit Vorschlägen zum Prüfen')).toBeTruthy();
});
