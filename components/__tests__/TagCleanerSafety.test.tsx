import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TagCleanerButton } from '../TagCleanerButton';
import { TagCleanerPreviewRow } from '../TagCleanerPreviewRow';
import { analyzeCleanerRows } from '../../utils/tagCleanerRules';
import { getAppTheme } from '../../utils/appTheme';
const mockTheme = getAppTheme('dark','graphite');
jest.mock('../../contexts/AppThemeContext',()=>({useAppTheme:()=>({theme:mockTheme})}));
test('Cleaner button and independent field checkbox have real minimum 48dp targets',()=>{
 const button=render(<TagCleanerButton label="Weiter" testID="next" onPress={jest.fn()}/>);
 expect(StyleSheet.flatten(button.getByTestId('next').props.style).minHeight).toBeGreaterThanOrEqual(48);
 const row=analyzeCleanerRows([{id:'a',title:'  Titel ',artist:'Artist'}],[{tags:{},inventory:[],verified:false}])[0];
 const preview=render(<TagCleanerPreviewRow row={row} onChange={jest.fn()} disabled={false}/>);
 expect(StyleSheet.flatten(preview.getByTestId('tag-cleaner-change-a-title').props.style).minHeight).toBeGreaterThanOrEqual(48);
});
