const fs = require('node:fs');
const path = require('node:path');

// Metro development bundles do not remove an icon barrel's unused exports.
// Resolve the installed package's real export names (including aliases), so
// only the requested icons enter the graph. Keep Lucide's renderer and license.
module.exports = function selectLucideImports({ types: t }) {
  let exportsByName;
  const resolveExport = name => {
    if (!exportsByName) {
      exportsByName = new Map();
      const esmRoot = path.resolve(path.dirname(require.resolve('lucide-react-native')), '../esm');
      const source = fs.readFileSync(path.join(esmRoot, 'lucide-react-native.js'), 'utf8');
      for (const match of source.matchAll(/export \{([^}]+)\} from '([^']+)';/g)) {
        for (const specifier of match[1].split(',')) {
          const parts = specifier.trim().split(/\s+as\s+/);
          exportsByName.set(parts[1] || parts[0], {
            imported: parts[0], filename: path.resolve(esmRoot, match[2]),
          });
        }
      }
    }
    return exportsByName.get(name);
  };
  return {
    name: 'select-lucide-native-imports',
    visitor: {
      ImportDeclaration(importPath) {
        const node = importPath.node;
        if (node.source.value !== 'lucide-react-native' || node.importKind === 'type') return;
        const replacements = [];
        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') continue;
          const name = t.isImportSpecifier(specifier) ? specifier.imported.name : undefined;
          const target = name && resolveExport(name);
          if (!target) throw importPath.buildCodeFrameError('Use a named Lucide icon import; unsupported export: ' + name);
          const binding = target.imported === 'default' ? t.importDefaultSpecifier(specifier.local)
            : t.importSpecifier(specifier.local, t.identifier(target.imported));
          replacements.push(t.importDeclaration([binding], t.stringLiteral(target.filename)));
        }
        importPath.replaceWithMultiple(replacements);
      },
    },
  };
};
