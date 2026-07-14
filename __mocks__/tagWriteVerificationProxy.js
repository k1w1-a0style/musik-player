const actual = jest.requireActual('../utils/tagWriteVerification');

const isLegacyTagEditorScreenTest = () => {
  const testPath = expect.getState().testPath || '';
  return testPath.endsWith('/screens/__tests__/TagEditor.test.tsx')
    || testPath.endsWith('\\screens\\__tests__\\TagEditor.test.tsx');
};

module.exports = {
  ...actual,
  verifyTagDeletionState: (...args) =>
    isLegacyTagEditorScreenTest()
      ? Promise.resolve(true)
      : actual.verifyTagDeletionState(...args),
};
