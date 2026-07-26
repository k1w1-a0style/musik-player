import path from 'path';

const script = path.join(__dirname, '..', 'checkNpmAudit.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateAudit } = require(script) as {
  evaluateAudit: (input: Record<string, unknown>) => { failures: string[]; warnings: string[] };
};

const lock = (version = '1.8.3') => ({ packages: { 'node_modules/shell-quote': { version } } });
const policy = {
  schemaVersion: 1,
  exceptions: [{
    package: 'shell-quote',
    severity: 'critical',
    expectedVersions: ['1.8.3'],
    issue: 'https://github.com/k1w1-a0style/musik-player/issues/318',
    expiresOn: '2026-10-31',
    reason: 'Tracked build-tooling advisory without a published compatible patched release yet.',
  }],
};
const audit = (vulnerabilities: Record<string, unknown>) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 13 } },
});

const shellQuote = { severity: 'critical' };

describe('npm audit policy gate', () => {
  it('passes with an empty exception list when no high or critical findings remain', () => {
    const result = evaluateAudit({
      audit: audit({}),
      policy: { schemaVersion: 1, exceptions: [] },
      lock: lock('1.10.0'),
      today: '2026-07-25',
    });
    expect(result.failures).toEqual([]);
  });

  it('accepts only the exact documented and unexpired exception', () => {
    const result = evaluateAudit({
      audit: audit({ 'shell-quote': shellQuote }),
      policy,
      lock: lock(),
      today: '2026-07-25',
    });
    expect(result.failures).toEqual([]);
  });

  it('fails an unexpected high vulnerability', () => {
    const result = evaluateAudit({
      audit: audit({ 'shell-quote': shellQuote, dangerous: { severity: 'high' } }),
      policy,
      lock: lock(),
      today: '2026-07-25',
    });
    expect(result.failures).toContain('dangerous: unexpected high vulnerability');
  });

  it('fails when the excepted package version changes', () => {
    const result = evaluateAudit({
      audit: audit({ 'shell-quote': shellQuote }),
      policy,
      lock: lock('1.8.4'),
      today: '2026-07-25',
    });
    expect(result.failures.join('\n')).toContain('installed 1.8.4 is not one of the explicitly excepted versions');
  });

  it('fails an expired exception', () => {
    const result = evaluateAudit({
      audit: audit({ 'shell-quote': shellQuote }),
      policy,
      lock: lock(),
      today: '2026-11-01',
    });
    expect(result.failures).toContain('shell-quote: exception expired on 2026-10-31');
  });
});
