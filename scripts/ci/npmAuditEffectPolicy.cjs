'use strict';

function canonicalEffect(name, vulnerability, lock) {
  return JSON.stringify({
    package: name,
    severity: vulnerability.severity,
    via: [...new Set(vulnerability.via.filter(item => typeof item === 'string'))].sort(),
    nodes: [...new Set(vulnerability.nodes)].sort(),
    versions: [...new Set(vulnerability.nodes.map(node => lock.packages[node]?.version))].sort(),
  });
}

function validateEffectPolicy(audit, policy, lock) {
  // Generic callers without a compensating-payload decision retain the root
  // policy. Every real compensated decision must also pin the entire effect
  // graph: an added effect cannot borrow approval from one familiar root.
  const required = policy.exceptions.some(entry => entry.requiredToolingPatch);
  if (!required && !Object.hasOwn(policy, 'expectedBlockingEffects')) return [];
  if (!Array.isArray(policy.expectedBlockingEffects)) return ['missing exact blocking dependency-effect policy'];
  const expected = policy.expectedBlockingEffects.map(entry => JSON.stringify(entry)).sort();
  const current = Object.entries(audit.vulnerabilities)
    .filter(([, entry]) => ['high', 'critical'].includes(entry.severity)
      && !entry.via.some(item => item && typeof item === 'object'))
    .map(([name, entry]) => canonicalEffect(name, entry, lock)).sort();
  const unexpected = current.filter(entry => !expected.includes(entry));
  const stale = expected.filter(entry => !current.includes(entry));
  return [...unexpected.map(entry => `unexpected blocking dependency effect: ${entry}`),
    ...stale.map(entry => `stale blocking dependency effect: ${entry}`)];
}

module.exports = { validateEffectPolicy };
