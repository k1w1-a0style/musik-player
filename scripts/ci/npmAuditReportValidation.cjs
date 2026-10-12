'use strict';

const severityRank = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });
const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const advisoryUrl = /^https:\/\/github\.com\/advisories\/GHSA-[a-z0-9-]+$/;

function validateVia(name, vulnerability, vulnerabilities) {
  if (!Array.isArray(vulnerability.via)) return [`${name}: missing advisory/effect list`];
  return vulnerability.via.flatMap(item => {
    if (typeof item === 'string' && item) {
      return Object.hasOwn(vulnerabilities, item) ? [] : [`${name}: unknown dependency effect ${item}`];
    }
    if (!isRecord(item) || !Number.isSafeInteger(item.source) || item.source <= 0
      || !advisoryUrl.test(item.url) || !Object.hasOwn(severityRank, item.severity)
      || typeof item.name !== 'string' || !item.name) {
      return [`${name}: invalid advisory identity or severity`];
    }
    if (severityRank[item.severity] > severityRank[vulnerability.severity]) {
      return [`${name}: advisory severity exceeds reported vulnerability severity`];
    }
    return [];
  });
}

function validateNodes(name, vulnerability, lock) {
  if (!Array.isArray(vulnerability.nodes) || vulnerability.nodes.length === 0
    || vulnerability.nodes.some(node => typeof node !== 'string' || !node.startsWith('node_modules/'))) {
    return [`${name}: missing vulnerable lock nodes`];
  }
  return vulnerability.nodes.flatMap(node => typeof lock.packages[node]?.version === 'string'
    && lock.packages[node].version ? [] : [`${name}: missing vulnerable lock node ${node}`]);
}

function validateCounts(audit) {
  const counts = audit.metadata?.vulnerabilities;
  if (!isRecord(counts)) return ['missing audit vulnerability counts'];
  const observed = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const entry of Object.values(audit.vulnerabilities)) {
    if (Object.hasOwn(observed, entry?.severity)) observed[entry.severity] += 1;
  }
  const failures = Object.entries(observed).flatMap(([severity, count]) =>
    counts[severity] === count ? [] : [`audit ${severity} count differs from reported entries`]);
  if (counts.total !== Object.values(observed).reduce((sum, count) => sum + count, 0)) {
    failures.push('audit total vulnerability count differs from reported entries');
  }
  return failures;
}

function validateAuditReport(audit, lock) {
  if (!isRecord(audit) || Object.hasOwn(audit, 'error') || audit.auditReportVersion !== 2
    || !isRecord(audit.vulnerabilities)) return ['unsupported or incomplete npm audit JSON'];
  return [...validateCounts(audit), ...Object.entries(audit.vulnerabilities).flatMap(([name, vulnerability]) => {
    if (!isRecord(vulnerability) || !Object.hasOwn(severityRank, vulnerability.severity)) {
      return [`${name}: unknown or missing vulnerability severity`];
    }
    return [...validateVia(name, vulnerability, audit.vulnerabilities), ...validateNodes(name, vulnerability, lock)];
  })];
}

module.exports = { validateAuditReport };
