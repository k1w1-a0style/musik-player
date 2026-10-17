import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TagCleanerProcess } from '../TagCleanerProcess';
import { TagCleanerButton } from '../TagCleanerButton';
import { TagCleanerPreviewRow } from '../TagCleanerPreviewRow';
import { analyzeCleanerRows } from '../../utils/tagCleanerRules';
import { getAppTheme } from '../../utils/appTheme';
jest.mock('../../hooks/useReducedMotion',()=>({useReducedMotion:()=>true}));
const mockTheme = getAppTheme('dark','graphite');
jest.mock('../../contexts/AppThemeContext',()=>({useAppTheme:()=>({theme:mockTheme})}));
test('Cleaner button and independent field checkbox have real minimum 48dp targets',()=>{
 const button=render(<TagCleanerButton label="Weiter" testID="next" onPress={jest.fn()}/>);
 expect(StyleSheet.flatten(button.getByTestId('next').props.style).minHeight).toBeGreaterThanOrEqual(48);
 const row=analyzeCleanerRows([{id:'a',title:'  Titel ',artist:'Artist'}],[{tags:{},inventory:[],verified:false}])[0];
 const preview=render(<TagCleanerPreviewRow row={row} onChange={jest.fn()} disabled={false}/>);
 expect(StyleSheet.flatten(preview.getByTestId('tag-cleaner-change-a-title').props.style).minHeight).toBeGreaterThanOrEqual(48);
});

test('a pending native/Library acknowledgement cannot show a completed progress bar',()=>{
 const view=render(<TagCleanerProcess process={{operation:'apply',phase:'failed',completed:1,total:1,confirmed:0,failed:0,cancelRequested:false,recoveryPending:true}}/>);
 expect(view.getByRole('progressbar').props.accessibilityValue.now).toBe(0);
 expect(view.getByText('0 bestätigt · 0 fehlgeschlagen')).toBeTruthy();
});
