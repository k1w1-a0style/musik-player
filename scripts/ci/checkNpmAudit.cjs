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

const advisoriesFor = vulnerability => {
  const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
  return via
    .filter(item => item && typeof item === 'object' && Number.isInteger(item.source))
    .map(item => ({ source: item.source, url: item.url }))
    .sort((left, right) => left.source - right.source);
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
  if (!Array.isArray(entry.advisories) || entry.advisories.length === 0
      || entry.advisories.some(advisory => !Number.isInteger(advisory?.source) || advisory.source <= 0
        || !/^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/.test(advisory?.url))) {
    return `${entry.package}: advisories must bind each positive source id to a GitHub advisory URL`;
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
  const parsedExpiry = new Date(`${entry.expiresOn}T00:00:00Z`);
  if (Number.isNaN(parsedExpiry.valueOf()) || parsedExpiry.toISOString().slice(0, 10) !== entry.expiresOn) {
    return `${entry.package}: expiresOn is not a valid calendar date`;
  }
  if (entry.expiresOn < today) return `${entry.package}: exception expired on ${entry.expiresOn}`;
  return null;
};

const difference = (left, right) => left.filter(value => !right.includes(value));

const createBlockingAdvisoryPathResolver = vulnerabilities => {
  const memo = new Map();

  const resolve = (packageName, visiting = new Set()) => {
    if (memo.has(packageName)) return memo.get(packageName);
    const vulnerability = vulnerabilities[packageName];
    if (!vulnerability || !isBlocking(vulnerability.severity)) {
      memo.set(packageName, false);
      return false;
    }
    if (advisorySourcesFor(vulnerability).length > 0) {
      memo.set(packageName, true);
      return true;
    }
    if (visiting.has(packageName)) return false;

    const nextVisiting = new Set(visiting);
    nextVisiting.add(packageName);
    const result = dependencyRootsFor(vulnerability)
      .some(dependency => resolve(dependency, nextVisiting));
    memo.set(packageName, result);
    return result;
  };

  return resolve;
};

const evaluateAudit = ({ audit, policy, lock, today }) => {
  if (audit.auditReportVersion !== 2 || !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    return { failures: ['unsupported or incomplete npm audit JSON'], warnings: [] };
  }
  if (policy.schemaVersion !== 2 || !Array.isArray(policy.exceptions)) {
    return { failures: ['unsupported npm audit exception policy'], warnings: [] };
  }
  if (!lock || typeof lock !== 'object' || !lock.packages || typeof lock.packages !== 'object') {
    return { failures: ['unsupported or incomplete package-lock JSON'], warnings: [] };
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
  const hasBlockingAdvisoryPath = createBlockingAdvisoryPathResolver(audit.vulnerabilities);

  const usedExceptions = new Set();
  let blockingRootCount = 0;
  let collapsedEffectCount = 0;
  for (const [packageName, vulnerability] of blockingEntries) {
    const severity = vulnerability?.severity;
    const advisorySources = advisorySourcesFor(vulnerability);
    if (advisorySources.length === 0) {
      const dependencies = dependencyRootsFor(vulnerability);
      if (dependencies.length === 0) {
        failures.push(`${packageName}: blocking vulnerability has no advisory source or dependency root`);
        continue;
      }
      if (!hasBlockingAdvisoryPath(packageName)) {
        failures.push(
          `${packageName}: blocking effect has no path to a known blocking advisory root [${dependencies.join(', ')}]`,
        );
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

    const expectedSources = [...new Set(exception.advisories.map(advisory => advisory.source))]
      .sort((left, right) => left - right);
    const unexpectedSources = difference(advisorySources, expectedSources);
    const staleSources = difference(expectedSources, advisorySources);
    if (unexpectedSources.length > 0 || staleSources.length > 0) {
      failures.push(
        `${packageName}: advisory sources changed; current [${advisorySources.join(', ')}], excepted [${expectedSources.join(', ')}]`,
      );
    }
    const currentAdvisories = advisoriesFor(vulnerability);
    const expectedAdvisories = exception.advisories
      .map(advisory => `${advisory.source}:${advisory.url}`)
      .sort();
    const currentAdvisoryIdentities = currentAdvisories
      .map(advisory => `${advisory.source}:${advisory.url}`)
      .sort();
    if (currentAdvisoryIdentities.length !== expectedAdvisories.length
        || difference(currentAdvisoryIdentities, expectedAdvisories).length > 0
        || difference(expectedAdvisories, currentAdvisoryIdentities).length > 0) {
      failures.push(`${packageName}: advisory identities changed`);
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
      failures.push(`${entry.package}: exception is currently unused and must be removed`);
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
  advisoriesFor,
  advisorySourcesFor,
  createBlockingAdvisoryPathResolver,
  dependencyRootsFor,
  evaluateAudit,
  packageVersionsFromLock,
  validateException,
};
