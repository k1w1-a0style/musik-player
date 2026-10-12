'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert');
const os = require('os');
const { execFileSync } = require('child_process');
const root = process.cwd();
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 1024, publicExponent: 3 });
const pem = key.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const message = Buffer.from('Independent DER boundary regression');
function opensslCertificate() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tooling-certificate-'));
  try {
    const privateFile = path.join(temporary, 'key.pem');
    const certificateFile = path.join(temporary, 'certificate.pem');
    fs.writeFileSync(privateFile, key.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    execFileSync('openssl', ['req', '-new', '-x509', '-key', privateFile, '-out', certificateFile,
      '-subj', '/CN=tooling-regression.invalid', '-days', '1', '-sha256'], { stdio: 'pipe' });
    return fs.readFileSync(certificateFile, 'utf8');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
const certificatePem = opensslCertificate();
const oids = { sha1: '2b0e03021a', sha224: '608648016503040204', sha256: '608648016503040201', sha384: '608648016503040202', sha512: '608648016503040203' };
const cases = [];
function record(name, callback) {
  try { callback(); cases.push({ name, passed: true }); }
  catch (error) { cases.push({ name, passed: false, message: error.message }); }
}
function tlv(tag, bytes, long = false) {
  return Buffer.concat([Buffer.from(long ? [tag, 0x81, bytes.length] : [tag, bytes.length]), bytes]);
}
function digestInfo(algorithm, variant) {
  const hash = crypto.createHash(algorithm).update(message).digest();
  const oid = tlv(6, Buffer.from(oids[algorithm], 'hex'));
  let parameters = Buffer.from([5, 0]);
  if (variant === 'parameterless') parameters = Buffer.alloc(0);
  if (variant === 'nullPayload') parameters = Buffer.from([5, 2, 0xab, 0xcd]);
  if (variant === 'nonNullParameters') parameters = Buffer.from([2, 2, 0xab, 0xcd]);
  if (variant === 'innerExtra') parameters = Buffer.from([5, 0, 2, 2, 0xab, 0xcd]);
  const inner = tlv(0x30, Buffer.concat([oid, parameters]), variant === 'nonMinimalLength');
  const contents = [inner, tlv(4, hash)];
  if (variant === 'outerExtra') contents.push(Buffer.from([2, 1, 0]));
  return { hash, der: tlv(0x30, Buffer.concat(contents), variant === 'nonMinimalLength') };
}
function loadForge(entry) {
  if (entry === 'lib') return require(path.join(root, 'node_modules/node-forge'));
  const sandbox = { window: {}, self: {}, console, setTimeout, clearTimeout, Uint8Array, ArrayBuffer, jQuery: Object.assign(() => ({ mousemove: () => {}, keypress: () => {} }), { ajax: () => {}, param: () => {}, fn: {} }) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'node_modules/node-forge/dist', entry), 'utf8'), sandbox);
  return sandbox.window.forge;
}
for (const entry of ['lib', 'forge.min.js', 'forge.all.min.js']) {
  const forge = loadForge(entry);
  const publicKey = forge.pki.publicKeyFromPem(pem);
  record(`${entry}:opensslCertificate`, () => {
    const certificate = forge.pki.certificateFromPem(certificatePem);
    assert.strictEqual(certificate.verify(certificate), true);
  });
  for (const algorithm of Object.keys(oids)) {
    for (const variant of ['standard', 'parameterless', 'innerExtra', 'nonNullParameters', 'nullPayload', 'nonMinimalLength', 'outerExtra']) {
      record(`${entry}:${algorithm}:${variant}`, () => {
        const { hash, der } = digestInfo(algorithm, variant);
        const signature = crypto.privateEncrypt({ key: key.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, der);
        let verified = false;
        try { verified = publicKey.verify(hash.toString('binary'), signature.toString('binary')); } catch { /* rejected */ }
        assert.strictEqual(verified, variant === 'standard' || variant === 'parameterless');
      });
    }
    record(`${entry}:${algorithm}:opensslSigner`, () => {
      const signature = crypto.sign(algorithm, message, key.privateKey);
      assert.strictEqual(publicKey.verify(crypto.createHash(algorithm).update(message).digest('binary'), signature.toString('binary')), true);
    });
  }
}
const braces = require(path.join(root, 'node_modules/braces'));
for (const operation of ['compile', 'expand', 'stringify']) {
  record(`braces:${operation}:depth`, () => {
    let ast = { type: 'text', value: 'x' };
    for (let i = 0; i < 4000; i++) ast = { type: 'root', nodes: [ast] };
    assert.throws(() => braces[operation](ast), SyntaxError);
  });
  record(`braces:${operation}:cycle`, () => {
    const ast = { type: 'root', nodes: [] }; ast.nodes.push(ast);
    assert.throws(() => braces[operation](ast), SyntaxError);
  });
}
record('braces:parserDepth', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) assert.throws(() => braces.parse(open.repeat(4000) + 'a,b' + close.repeat(4000)), SyntaxError);
});
record('braces:ordinaryPatterns', () => {
  assert.deepStrictEqual(braces.expand('a/{1..3}/{x,y}'), ['a/1/x', 'a/1/y', 'a/2/x', 'a/2/y', 'a/3/x', 'a/3/y']);
  const leaf = { type: 'text', value: 'a' };
  assert.strictEqual(braces.stringify({ type: 'root', nodes: [leaf, leaf] }), 'aa');
  assert.doesNotThrow(() => braces.compile('{'.repeat(64) + 'x,y' + '}'.repeat(64)));
  assert.doesNotThrow(() => braces.compile('x/{a,b')); // pre-existing permissive incomplete input
  const subtree = braces.parse('a/{b,c}').nodes[1];
  assert.doesNotThrow(() => braces.stringify(subtree));
});
for (const operation of ['compile', 'expand', 'stringify']) {
  record(`braces:${operation}:sharedDagBudget`, () => {
    let ast = { type: 'text', value: 'x' };
    for (let i = 0; i < 17; i++) ast = { type: 'root', nodes: [ast, ast] };
    assert.throws(() => braces[operation](ast), SyntaxError);
  });
  record(`braces:${operation}:boundaryDepth`, () => {
    let ast = { type: 'text', value: 'x' };
    for (let i = 0; i < 128; i++) ast = { type: 'root', nodes: [ast] };
    assert.doesNotThrow(() => braces[operation](ast));
    ast = { type: 'root', nodes: [ast] };
    assert.throws(() => braces[operation](ast), SyntaxError);
  });
}
record('braces:parentCycle', () => {
  const parent = { type: 'paren', nodes: [{ type: 'text', value: 'x' }] };
  parent.parent = parent;
  assert.throws(() => braces.expand({ type: 'root', nodes: [parent] }), SyntaxError);
});
record('braces:parentDepth', () => {
  let parent = { type: 'root', nodes: [] };
  for (let i = 0; i < 129; i++) parent = { type: 'paren', parent, nodes: [] };
  assert.throws(() => braces.expand({ type: 'root', nodes: [parent] }), SyntaxError);
});
record('braces:foreignParentSubtree', () => {
  const source = braces.parse('a/{b,c}');
  const subtree = source.nodes.find(node => node.type === 'brace');
  assert.strictEqual(braces.stringify(subtree), '{b,c}');
  assert.doesNotThrow(() => braces.compile(subtree));
  assert.deepStrictEqual(braces.expand({ type: 'root', nodes: [subtree] }), ['b', 'c']);
});
record('braces:parserBoundaryDepth', () => {
  assert.doesNotThrow(() => braces.compile('{'.repeat(127) + 'a,b' + '}'.repeat(127)));
  assert.throws(() => braces.parse('{'.repeat(128) + 'a,b' + '}'.repeat(128)), SyntaxError);
});
record('braces:wideBoundary', () => {
  const leaf = { type: 'text', value: 'x' };
  assert.strictEqual(braces.stringify({ type: 'root', nodes: Array(65535).fill(leaf) }).length, 65535);
  assert.throws(() => braces.stringify({ type: 'root', nodes: Array(65536).fill(leaf) }), SyntaxError);
});
console.log(JSON.stringify(cases));
