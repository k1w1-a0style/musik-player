module.exports = {
  root: true,
  extends: ['universe/native', 'universe/shared/typescript-analysis'],
  env: {
    node: true,
  },
  parserOptions: {
    project: './tsconfig.json',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/consistent-type-imports': 'warn',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always',
      },
    ],
  },
};
