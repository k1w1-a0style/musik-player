import path from 'path';

const script = path.join(__dirname, '..', 'checkNpmAudit.cjs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { evaluateAudit } = require(script) as {
  evaluateAudit: (input: Record<string, unknown>) => { failures: string[]; warnings: string[] };
};

const lock = (versions: Record<string, string> = { 'node_modules/brace-expansion': '2.1.2' }) => ({
  packages: Object.fromEntries(
    Object.entries(versions).map(([node, version]) => [node, { version }]),
  ),
});
const policy = {
  schemaVersion: 2,
  exceptions: [{
    package: 'brace-expansion',
    severity: 'high',
    advisories: [{ source: 1124334, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }],
    expectedVersions: ['1.1.16', '2.1.2'],
    issue: 'https://github.com/k1w1-a0style/musik-player/issues/319',
    expiresOn: '2026-08-31',
    reason: 'Legacy Expo and React Native CLI consumers remain build-time-only while compatible maintenance fixes are pending.',
  }],
};
const audit = (vulnerabilities: Record<string, unknown>) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 13 } },
});

const braceExpansion = {
  severity: 'high',
  via: [{ source: 1124334, name: 'brace-expansion', severity: 'high', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }],
  nodes: [
    'node_modules/brace-expansion',
    'node_modules/test-exclude/node_modules/brace-expansion',
  ],
};

const vulnerableLock = () => lock({
  'node_modules/brace-expansion': '2.1.2',
  'node_modules/test-exclude/node_modules/brace-expansion': '1.1.16',
});

describe('npm audit policy gate', () => {
  it('passes with an empty exception list when no high or critical findings remain', () => {
    const result = evaluateAudit({
      audit: audit({}),
      policy: { schemaVersion: 2, exceptions: [] },
      lock: lock(),
      today: '2026-07-26',
    });
    expect(result.failures).toEqual([]);
  });

  it('accepts only the exact advisory source and vulnerable lock versions', () => {
    const result = evaluateAudit({
      audit: audit({ 'brace-expansion': braceExpansion }),
      policy,
      lock: vulnerableLock(),
      today: '2026-07-26',
    });
    expect(result.failures).toEqual([]);
  });

  it('collapses a multi-hop blocking effect chain that reaches a known advisory root', () => {
    const result = evaluateAudit({
      audit: audit({
        'brace-expansion': braceExpansion,
        minimatch: { severity: 'high', via: ['brace-expansion'], nodes: ['node_modules/minimatch'] },
        glob: { severity: 'high', via: ['minimatch'], nodes: ['node_modules/glob'] },
        expo: { severity: 'high', via: ['glob', 'tar'], nodes: ['node_modules/expo'] },
        tar: {
          severity: 'moderate',
          via: [{ source: 1124000, name: 'tar', severity: 'moderate' }],
          nodes: ['node_modules/tar'],
        },
      }),
      policy,
      lock: vulnerableLock(),
      today: '2026-07-26',
    });
    expect(result.failures).toEqual([]);
    expect(result.warnings.join('\n')).toContain('collapsed transitive effect entries: 3');
  });

  it('fails a blocking effect that has no path to a known blocking advisory root', () => {
    const result = evaluateAudit({
      audit: audit({
        minimatch: { severity: 'high', via: ['missing-root'], nodes: ['node_modules/minimatch'] },
      }),
      policy: { schemaVersion: 2, exceptions: [] },
      lock: lock(),
      today: '2026-07-26',
    });
    expect(result.failures).toContain(
      'minimatch: blocking effect has no path to a known blocking advisory root [missing-root]',
    );
  });

  it('fails a cyclic blocking effect graph without an advisory root', () => {
    const result = evaluateAudit({
      audit: audit({
        alpha: { severity: 'high', via: ['beta'], nodes: ['node_modules/alpha'] },
        beta: { severity: 'high', via: ['alpha'], nodes: ['node_modules/beta'] },
      }),
      policy: { schemaVersion: 2, exceptions: [] },
      lock: lock(),
      today: '2026-07-26',
    });
    expect(result.failures).toEqual(expect.arrayContaining([
      'alpha: blocking effect has no path to a known blocking advisory root [beta]',
      'beta: blocking effect has no path to a known blocking advisory root [alpha]',
    ]));
  });

  it('fails a blocking entry without an advisory source or dependency root', () => {
    const result = evaluateAudit({
      audit: audit({ dangerous: { severity: 'high', via: [], nodes: ['node_modules/dangerous'] } }),
      policy: { schemaVersion: 2, exceptions: [] },
      lock: lock(),
      today: '2026-07-26',
    });
    expect(result.failures).toContain(
      'dangerous: blocking vulnerability has no advisory source or dependency root',
    );
  });

  it('fails an unexpected high advisory root', () => {
    const result = evaluateAudit({
      audit: audit({
        'brace-expansion': braceExpansion,
        dangerous: {
          severity: 'high',
          via: [{ source: 9999999, name: 'dangerous', severity: 'high', url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff' }],
          nodes: ['node_modules/dangerous'],
        },
      }),
      policy,
      lock: vulnerableLock(),
      today: '2026-07-26',
    });
    expect(result.failures).toContain('dangerous: unexpected high advisory root (9999999)');
  });

  it('fails when an excepted vulnerable package version changes', () => {
    const result = evaluateAudit({
      audit: audit({ 'brace-expansion': braceExpansion }),
      policy,
      lock: lock({
        'node_modules/brace-expansion': '2.1.3',
        'node_modules/test-exclude/node_modules/brace-expansion': '1.1.16',
      }),
      today: '2026-07-26',
    });
    expect(result.failures.join('\n')).toContain(
      'vulnerable versions changed; installed [1.1.16, 2.1.3], excepted [1.1.16, 2.1.2]',
    );
  });

  it('fails when the advisory source changes', () => {
    const result = evaluateAudit({
      audit: audit({
        'brace-expansion': {
          ...braceExpansion,
          via: [{ source: 1124999, name: 'brace-expansion', severity: 'high', url: 'https://github.com/advisories/GHSA-xxxx-yyyy-zzzz' }],
        },
      }),
      policy,
      lock: vulnerableLock(),
      today: '2026-07-26',
    });
    expect(result.failures.join('\n')).toContain(
      'advisory sources changed; current [1124999], excepted [1124334]',
    );
  });

  it('fails an expired exception', () => {
    const result = evaluateAudit({
      audit: audit({ 'brace-expansion': braceExpansion }),
      policy,
      lock: vulnerableLock(),
      today: '2026-09-01',
    });
    expect(result.failures).toContain('brace-expansion: exception expired on 2026-08-31');
  });

  it('fails when an advisory source is rebound to a different GHSA URL', () => {
    const changed = { ...braceExpansion, via: [{ ...braceExpansion.via[0], url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff' }] };
    const result = evaluateAudit({ audit: audit({ 'brace-expansion': changed }), policy, lock: vulnerableLock(), today: '2026-07-26' });
    expect(result.failures).toContain('brace-expansion: advisory identities changed');
  });

  it('fails stale exceptions instead of merely warning', () => {
    const result = evaluateAudit({ audit: audit({}), policy, lock: vulnerableLock(), today: '2026-07-26' });
    expect(result.failures).toContain('brace-expansion: exception is currently unused and must be removed');
  });

  it('rejects invalid calendar dates', () => {
    const invalid = { ...policy, exceptions: [{ ...policy.exceptions[0], expiresOn: '2026-02-30' }] };
    const result = evaluateAudit({ audit: audit({ 'brace-expansion': braceExpansion }), policy: invalid, lock: vulnerableLock(), today: '2026-01-01' });
    expect(result.failures).toContain('brace-expansion: expiresOn is not a valid calendar date');
  });

  it('fails an incomplete lockfile structure', () => {
    const result = evaluateAudit({ audit: audit({ 'brace-expansion': braceExpansion }), policy, lock: {}, today: '2026-07-26' });
    expect(result.failures).toEqual(['unsupported or incomplete package-lock JSON']);
  });

  it('fails a severity change', () => {
    const result = evaluateAudit({ audit: audit({ 'brace-expansion': { ...braceExpansion, severity: 'critical' } }), policy, lock: vulnerableLock(), today: '2026-07-26' });
    expect(result.failures).toContain('brace-expansion: vulnerability severity changed from excepted high to critical');
  });
});
