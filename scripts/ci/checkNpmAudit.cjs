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

const advisorySourcesFor = vulnerability => {
  const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
  return [...new Set(via
    .filter(item => item && typeof item === 'object' && Number.isInteger(item.source))
    .map(item => item.source))]
    .sort((left, right) => left - right);
};

const dependencyRootsFor = vulnerability => {
  const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
  return [...new Set(via.filter(item => typeof item === 'string' && item))].sort();
};

const packageVersionsFromLock = (lock, packageName, vulnerability) => {
  const declaredNodes = Array.isArray(vulnerability?.nodes)
    ? vulnerability.nodes.filter(node => typeof node === 'string' && node)
    : [];
  const nodes = declaredNodes.length > 0 ? declaredNodes : [`node_modules/${packageName}`];
  return [...new Set(nodes
    .map(node => lock.packages?.[node]?.version)
    .filter(version => typeof version === 'string' && version))]
    .sort();
};

const validateException = (entry, today) => {
  if (!entry || typeof entry !== 'object') return 'exception must be an object';
  if (typeof entry.package !== 'string' || !entry.package) return 'exception package is required';
  if (!isBlocking(entry.severity)) return `${entry.package}: exception severity must be high or critical`;
  if (!Array.isArray(entry.expectedVersions) || entry.expectedVersions.length === 0
      || entry.expectedVersions.some(version => typeof version !== 'string' || !version)) {
    return `${entry.package}: expectedVersions must contain at least one exact version`;
  }
  if (!Array.isArray(entry.advisorySources) || entry.advisorySources.length === 0
      || entry.advisorySources.some(source => !Number.isInteger(source) || source <= 0)) {
    return `${entry.package}: advisorySources must contain at least one positive integer source id`;
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

const difference = (left, right) => left.filter(value => !right.includes(value));

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

  const blockingEntries = Object.entries(audit.vulnerabilities)
    .filter(([, vulnerability]) => isBlocking(vulnerability?.severity));
  const blockingRoots = new Set(
    blockingEntries
      .filter(([, vulnerability]) => advisorySourcesFor(vulnerability).length > 0)
      .map(([packageName]) => packageName),
  );

  const usedExceptions = new Set();
  let blockingRootCount = 0;
  let collapsedEffectCount = 0;
  for (const [packageName, vulnerability] of blockingEntries) {
    const severity = vulnerability?.severity;
    const advisorySources = advisorySourcesFor(vulnerability);
    if (advisorySources.length === 0) {
      const dependencyRoots = dependencyRootsFor(vulnerability);
      if (dependencyRoots.length === 0) {
        failures.push(`${packageName}: blocking vulnerability has no advisory source or dependency root`);
        continue;
      }
      const unknownRoots = dependencyRoots.filter(root => !blockingRoots.has(root));
      if (unknownRoots.length > 0) {
        failures.push(`${packageName}: blocking effect references unknown advisory roots [${unknownRoots.join(', ')}]`);
        continue;
      }
      collapsedEffectCount += 1;
      continue;
    }
    blockingRootCount += 1;

    const exception = exceptions.get(packageName);
    if (!exception) {
      failures.push(`${packageName}: unexpected ${severity} advisory root (${advisorySources.join(', ')})`);
      continue;
    }
    usedExceptions.add(packageName);
    if (exception.severity !== severity) {
      failures.push(`${packageName}: vulnerability severity changed from excepted ${exception.severity} to ${severity}`);
    }

    const expectedSources = [...new Set(exception.advisorySources)].sort((left, right) => left - right);
    const unexpectedSources = difference(advisorySources, expectedSources);
    const staleSources = difference(expectedSources, advisorySources);
    if (unexpectedSources.length > 0 || staleSources.length > 0) {
      failures.push(
        `${packageName}: advisory sources changed; current [${advisorySources.join(', ')}], excepted [${expectedSources.join(', ')}]`,
      );
    }

    const installedVersions = packageVersionsFromLock(lock, packageName, vulnerability);
    if (installedVersions.length === 0) {
      failures.push(`${packageName}: vulnerable package versions are missing from package-lock.json`);
      continue;
    }
    const expectedVersions = [...new Set(exception.expectedVersions)].sort();
    const unexpectedVersions = difference(installedVersions, expectedVersions);
    const staleVersions = difference(expectedVersions, installedVersions);
    if (unexpectedVersions.length > 0 || staleVersions.length > 0) {
      failures.push(
        `${packageName}: vulnerable versions changed; installed [${installedVersions.join(', ')}], excepted [${expectedVersions.join(', ')}]`,
      );
    }
  }

  for (const entry of policy.exceptions) {
    if (!usedExceptions.has(entry.package)) {
      warnings.push(`${entry.package}: exception is currently unused and may be removable`);
    }
  }

  const counts = audit.metadata?.vulnerabilities ?? {};
  warnings.push(`audit counts: ${Number(counts.critical ?? 0)} critical, ${Number(counts.high ?? 0)} high, ${Number(counts.moderate ?? 0)} moderate`);
  warnings.push(`blocking advisory roots: ${blockingRootCount}; collapsed transitive effect entries: ${collapsedEffectCount}`);
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
  console.log('npm audit policy passed: no unapproved high or critical advisory roots.');
};

if (require.main === module) main();

module.exports = {
  advisorySourcesFor,
  dependencyRootsFor,
  evaluateAudit,
  packageVersionsFromLock,
  validateException,
};
