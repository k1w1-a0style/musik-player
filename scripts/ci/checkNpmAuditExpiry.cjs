#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { validateException } = require('./checkNpmAudit.cjs');

// Recheck at the end of long builds/device tests: a successful audit from
// before midnight cannot authorize release after its exceptions expire.
function policyExpiryFailures(policy, today) {
  if (policy?.schemaVersion !== 2 || !Array.isArray(policy.exceptions)) {
    return ['unsupported npm audit exception policy'];
  }
  return policy.exceptions.map(entry => validateException(entry, today)).filter(Boolean);
}

if (require.main === module) {
  const policy = JSON.parse(fs.readFileSync('security/npm-audit-exceptions.json', 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const failures = policyExpiryFailures(policy, today);
  if (failures.length) throw new Error(failures.join('; '));
  console.log(`Dependency security policy still valid at final gate (${today} UTC).`);
}

module.exports = { policyExpiryFailures };
