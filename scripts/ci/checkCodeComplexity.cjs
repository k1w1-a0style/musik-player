#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOTS = ['utils', 'contexts', 'hooks', 'components', 'screens', 'services'];
const DEFAULT_BASELINE_PATH = path.join('security', 'code-complexity-baseline.json');

const isProductionTypeScript = (filePath) =>
  /\.(ts|tsx)$/.test(filePath)
  && !filePath.includes(`${path.sep}__tests__${path.sep}`)
  && !/\.test\.(ts|tsx)$/.test(filePath)
  && !filePath.endsWith('.d.ts');

const collectFiles = (rootDir) => {
  const files = [];
  const visit = (relativeDir) => {
    const absoluteDir = path.join(rootDir, relativeDir);
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(relativePath);
      } else if (isProductionTypeScript(relativePath)) {
        files.push(relativePath.split(path.sep).join('/'));
      }
    }
  };
  ROOTS.forEach(visit);
  return files.sort();
};

const resolveFunctionName = (node, sourceFile) => {
  if (node.name) return node.name.getText(sourceFile);
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) {
    return parent.name.getText(sourceFile);
  }
  if (ts.isCallExpression(parent)) {
    const callName = parent.expression.getText(sourceFile).replace(/\s+/g, '');
    return `<${callName}-callback>`;
  }
  return '<anonymous>';
};

const calculateComplexity = (functionNode) => {
  let complexity = 1;
  const visit = (node) => {
    if (node !== functionNode && ts.isFunctionLike(node)) return;
    if (
      ts.isIfStatement(node)
      || ts.isForStatement(node)
      || ts.isForInStatement(node)
      || ts.isForOfStatement(node)
      || ts.isWhileStatement(node)
      || ts.isDoStatement(node)
      || ts.isCatchClause(node)
      || ts.isConditionalExpression(node)
      || ts.isCaseClause(node)
    ) complexity += 1;
    if (
      ts.isBinaryExpression(node)
      && [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) complexity += 1;
    ts.forEachChild(node, visit);
  };
  visit(functionNode.body);
  return complexity;
};

const analyzeFile = (rootDir, relativePath) => {
  const sourceText = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rows = [];
  const nameOccurrences = new Map();
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const name = resolveFunctionName(node, sourceFile);
      const occurrence = (nameOccurrences.get(name) ?? 0) + 1;
      nameOccurrences.set(name, occurrence);
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      rows.push({
        key: `${relativePath}::${name}#${occurrence}`,
        path: relativePath,
        name,
        occurrence,
        startLine,
        complexity: calculateComplexity(node),
        lines: endLine - startLine + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return rows;
};

const analyzeRepository = (rootDir) => collectFiles(rootDir).flatMap(file => analyzeFile(rootDir, file));

const buildBaseline = (rows, defaults) => ({
  schemaVersion: 1,
  defaultLimits: defaults,
  exceptions: Object.fromEntries(
    rows
      .filter(row => row.complexity > defaults.complexity || row.lines > defaults.maxLines)
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(row => [row.key, {
        maxComplexity: row.complexity,
        maxLines: row.lines,
        reason: 'Existing reviewed hotspot; must not grow and should be reduced when touched.',
      }]),
  ),
});

const evaluateComplexity = (rows, baseline) => {
  const failures = [];
  const usedExceptions = new Set();
  const defaults = baseline.defaultLimits;
  for (const row of rows) {
    const exception = baseline.exceptions[row.key];
    const maxComplexity = exception?.maxComplexity ?? defaults.complexity;
    const maxLines = exception?.maxLines ?? defaults.maxLines;
    if (exception) usedExceptions.add(row.key);
    if (row.complexity > maxComplexity || row.lines > maxLines) {
      failures.push(
        `${row.path}:${row.startLine} ${row.name} has complexity ${row.complexity}/${maxComplexity} and ${row.lines}/${maxLines} lines`,
      );
    }
  }
  for (const key of Object.keys(baseline.exceptions)) {
    if (!usedExceptions.has(key)) failures.push(`Stale complexity exception: ${key}`);
  }
  return failures;
};

const main = () => {
  const rootDir = process.cwd();
  const rows = analyzeRepository(rootDir);
  if (process.argv.includes('--print-baseline')) {
    process.stdout.write(`${JSON.stringify(buildBaseline(rows, { complexity: 15, maxLines: 80 }), null, 2)}\n`);
    return;
  }
  const baselinePath = process.argv[2] ?? DEFAULT_BASELINE_PATH;
  const baseline = JSON.parse(fs.readFileSync(path.join(rootDir, baselinePath), 'utf8'));
  const failures = evaluateComplexity(rows, baseline);
  if (failures.length > 0) {
    console.error('[complexity-gate] Code complexity policy failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`[complexity-gate] Passed for ${rows.length} production functions.`);
};

if (require.main === module) main();

module.exports = {
  analyzeRepository,
  buildBaseline,
  evaluateComplexity,
};
