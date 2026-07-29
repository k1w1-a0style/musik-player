import path from 'path';

const script = path.join(__dirname, '..', 'checkCodeComplexity.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateComplexity } = require(script) as {
  evaluateComplexity: (
    rows: Array<{ key: string; path: string; name: string; startLine: number; complexity: number; lines: number }>,
    baseline: { defaultLimits: { complexity: number; maxLines: number }; exceptions: Record<string, { maxComplexity: number; maxLines: number }> },
  ) => string[];
};

const row = (overrides: Partial<{ key: string; path: string; name: string; startLine: number; complexity: number; lines: number }> = {}) => ({
  key: 'utils/example.ts::work#1',
  path: 'utils/example.ts',
  name: 'work',
  startLine: 10,
  complexity: 8,
  lines: 30,
  ...overrides,
});

const baseline = {
  defaultLimits: { complexity: 15, maxLines: 80 },
  exceptions: {},
};

describe('code complexity regression gate', () => {
  test('accepts functions within the default limits', () => {
    expect(evaluateComplexity([row()], baseline)).toEqual([]);
  });

  test('rejects a new function above the default complexity limit', () => {
    expect(evaluateComplexity([row({ complexity: 16 })], baseline).join('\n')).toContain('complexity 16/15');
  });

  test('allows a documented hotspot only up to its recorded ceiling', () => {
    const exceptionBaseline = {
      ...baseline,
      exceptions: {
        'utils/example.ts::work#1': { maxComplexity: 20, maxLines: 100 },
      },
    };
    expect(evaluateComplexity([row({ complexity: 20, lines: 100 })], exceptionBaseline)).toEqual([]);
    expect(evaluateComplexity([row({ complexity: 21, lines: 100 })], exceptionBaseline).join('\n')).toContain('complexity 21/20');
  });

  test('rejects stale exceptions after a hotspot is removed or renamed', () => {
    const exceptionBaseline = {
      ...baseline,
      exceptions: {
        'utils/removed.ts::oldWork#1': { maxComplexity: 20, maxLines: 100 },
      },
    };
    expect(evaluateComplexity([row()], exceptionBaseline)).toContain(
      'Stale complexity exception: utils/removed.ts::oldWork#1',
    );
  });
});
