// Expo's legacy reader must not require storage write access for audio queries.
const fs = require('fs');
const path = require('path');
const { digest, replaceOnce } = require('./patchRntpV5.cjs');
const plan = require('./media-library-read-only.json');
const helperPath = 'android/src/main/java/expo/modules/medialibrary/AudioReadPermissionPolicy.kt';
const helperSource = path.join(__dirname, 'android/expo/modules/medialibrary/AudioReadPermissionPolicy.kt');

function patchMediaLibrary(packageDir) {
  const metadata = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  if (metadata.name !== 'expo-media-library' || metadata.version !== plan.version) {
    throw new Error(`Expected expo-media-library@${plan.version}; review the read-only patch before upgrading.`);
  }
  const filename = path.join(packageDir, plan.path);
  const original = fs.readFileSync(filename, 'utf8');
  const helper = fs.readFileSync(helperSource, 'utf8');
  const targetHelper = path.join(packageDir, helperPath);
  if (digest(helper) !== plan.helperSha256
      || (fs.existsSync(targetHelper) && digest(fs.readFileSync(targetHelper, 'utf8')) !== plan.helperSha256)) {
    throw new Error('Unverified audio read permission helper.');
  }
  const alreadyPatched = digest(original) === plan.patchedSha256;
  if (!alreadyPatched && digest(original) !== plan.upstreamSha256) {
    throw new Error('Unsupported Expo MediaLibrary native source; refusing to modify it.');
  }
  const patched = alreadyPatched ? original : replaceOnce(original, plan.from, plan.to, plan.path);
  if (digest(patched) !== plan.patchedSha256) throw new Error('Audio read patch checksum mismatch.');
  // Validate all boundaries before writing; repeat installs verify complete payloads.
  if (!alreadyPatched) fs.writeFileSync(filename, patched);
  fs.writeFileSync(targetHelper, helper);
  return alreadyPatched ? 0 : 1;
}
module.exports = { patchMediaLibrary, plan, helperPath };
if (require.main === module) {
  try {
    const root = process.argv[2] || path.resolve(__dirname, '../../node_modules/expo-media-library');
    console.log(`[patch-media-library] Verified read-only audio guard; ${patchMediaLibrary(root)} source files patched.`);
  } catch (error) {
    console.error(`[patch-media-library] ${error.message}`);
    process.exitCode = 1;
  }
}
