/* eslint-disable @typescript-eslint/no-require-imports */
const { transformSync } = require('@babel/core');
const plugin = require('./selectLucideImports.cjs');
const transform = (code: string) => transformSync(code, {
  babelrc: false, configFile: false, plugins: [plugin],
}).code as string;

test('resolves real icon aliases without importing the whole barrel', () => {
  const output = transform("import { Play, Edit3 as Rename } from 'lucide-react-native'; use(Play, Rename);");
  expect(output).toMatch(/import Play from .*\/icons\/play\.js/);
  expect(output).toMatch(/import Rename from .*\/icons\/pen-line\.js/);
  expect(output).not.toContain('lucide-react-native.js');
  expect(output).toContain('use(Play, Rename)');
});

test('keeps unrelated packages and rejects accidental full-library imports', () => {
  expect(transform("import { View } from 'react-native';")).toContain("from 'react-native'");
  expect(() => transform("import * as icons from 'lucide-react-native';")).toThrow('Use a named Lucide icon import');
});
