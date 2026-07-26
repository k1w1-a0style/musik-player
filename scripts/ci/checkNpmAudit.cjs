#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const fail = message => {
  console.error(`npm audit policy failed: ${message}`);
  process.exit(1);
};

const readJson = file => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`could not parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const severityRank = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });
const isBlocking = severity => (severityRank[severity] ?? -1) >= severityRank.high;

const packageVersionFromLock = (lock, packageName) => {
  const node = lock.packages?.[`node_modules/${packageName}`];
  return typeof node?.version === 'string' ? node.version : null;
};

const validateException = (entry, today) => {
  if (!entry || typeof entry !== 'object') return 'exception must be an object';
  if (typeof entry.package !== 'string' || !entry.package) return 'exception package is required';
  if (!isBlocking(entry.severity)) return `${entry.package}: exception severity must be high or critical`;
  if (!Array.isArray(entry.expectedVersions) || entry.expectedVersions.length === 0) {
    return `${entry.package}: expectedVersions must contain at least one exact version`;
  }
  if (typeof entry.issue !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(entry.issue)) {
    return `${entry.package}: issue must be a concrete GitHub issue URL`;
  }
  if (typeof entry.reason !== 'string' || entry.reason.trim().length < 40) {
    return `${entry.package}: reason must explain the bounded risk decision`;
  }
  if (typeof entry.expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn)) {
    return `${entry.package}: expiresOn must use YYYY-MM-DD`;
  }
  if (entry.expiresOn < today) return `${entry.package}: exception expired on ${entry.expiresOn}`;
  return null;
};

const evaluateAudit = ({ audit, policy, lock, today }) => {
  if (audit.auditReportVersion !== 2 || !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    return { failures: ['unsupported or incomplete npm audit JSON'], warnings: [] };
  }
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.exceptions)) {
    return { failures: ['unsupported npm audit exception policy'], warnings: [] };
  }

  const failures = [];
  const warnings = [];
  const exceptions = new Map();
  for (const entry of policy.exceptions) {
    const invalid = validateException(entry, today);
    if (invalid) failures.push(invalid);
    if (entry?.package) {
      if (exceptions.has(entry.package)) failures.push(`${entry.package}: duplicate exception`);
      exceptions.set(entry.package, entry);
    }
  }

  const usedExceptions = new Set();
  for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities)) {
    const severity = vulnerability?.severity;
    if (!isBlocking(severity)) continue;

    const exception = exceptions.get(packageName);
    if (!exception) {
      failures.push(`${packageName}: unexpected ${severity} vulnerability`);
      continue;
    }
    usedExceptions.add(packageName);
    if (exception.severity !== severity) {
      failures.push(`${packageName}: vulnerability severity changed from excepted ${exception.severity} to ${severity}`);
    }
    const installedVersion = packageVersionFromLock(lock, packageName);
    if (!installedVersion) {
      failures.push(`${packageName}: package version is missing from package-lock.json`);
    } else if (!exception.expectedVersions.includes(installedVersion)) {
      failures.push(`${packageName}: installed ${installedVersion} is not one of the explicitly excepted versions (${exception.expectedVersions.join(', ')})`);
    }
  }

  for (const entry of policy.exceptions) {
    if (!usedExceptions.has(entry.package)) {
      warnings.push(`${entry.package}: exception is currently unused and may be removable`);
    }
  }

  const counts = audit.metadata?.vulnerabilities ?? {};
  warnings.push(`audit counts: ${Number(counts.critical ?? 0)} critical, ${Number(counts.high ?? 0)} high, ${Number(counts.moderate ?? 0)} moderate`);
  return { failures, warnings };
};

const main = () => {
  const [auditPath, policyPath = 'security/npm-audit-exceptions.json', lockPath = 'package-lock.json'] = process.argv.slice(2);
  if (!auditPath) fail('usage: node scripts/ci/checkNpmAudit.cjs <audit.json> [policy.json] [package-lock.json]');

  const result = evaluateAudit({
    audit: readJson(path.resolve(auditPath)),
    policy: readJson(path.resolve(policyPath)),
    lock: readJson(path.resolve(lockPath)),
    today: new Date().toISOString().slice(0, 10),
  });
  for (const warning of result.warnings) console.log(`npm audit policy: ${warning}`);
  if (result.failures.length > 0) {
    console.error(result.failures.map(item => `- ${item}`).join('\n'));
    process.exit(1);
  }
  console.log('npm audit policy passed: no unapproved high or critical vulnerabilities.');
};

if (require.main === module) main();

module.exports = { evaluateAudit, packageVersionFromLock, validateException };
