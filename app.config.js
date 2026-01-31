const fs = require('fs');
const path = require('path');

function readJson(rel) {
  try {
    const p = path.join(__dirname, rel);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

const eas = readJson('eas-project.json');
const easProjectId = eas && eas.projectId ? String(eas.projectId) : undefined;

module.exports = ({ config }) => {
  const base = config || readJson('app.json') || {};
  const extra = { ...(base.extra || {}) };
  const easExtra = { ...((extra.eas) || {}) };
  if (!easExtra.projectId && easProjectId) easExtra.projectId = easProjectId;
  extra.eas = easExtra;
  return { ...base, extra };
};
