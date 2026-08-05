import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.join(__dirname, '../android/src/main/java/expo/modules/systemaudio/saf/AndroidSafContentStore.kt'),
  'utf8',
);

describe('Android SAF permission and writable flag guards', () => {
  test('document writability delegates only the write support flag to the policy', () => {
    const body = source.match(/override fun isWritable[\s\S]*?\n  }\n/)?.[0] ?? '';

    expect(body).toContain('FLAG_SUPPORTS_WRITE');
    expect(body).not.toContain('FLAG_SUPPORTS_DELETE');
    expect(body).toContain('return false');
    expect(body).toContain('SafPermissionPolicy.isDocumentWritableFromFlags');
  });

  test('SAF permission coverage avoids raw URI prefix comparisons', () => {
    expect(source).not.toContain('uri.toString().startsWith(perm.uri.toString())');
    expect(source).toContain('checkUriPermission');
    expect(source).toContain('perm.isWritePermission');
    expect(source).toContain('DocumentsContract.isTreeUri');
    expect(source).toContain('DocumentsContract.getTreeDocumentId');
    expect(source).toContain('DocumentsContract.getDocumentId');
  });

  test('tree permission coverage compares document ids under the persisted tree', () => {
    const body = source.match(/private fun isUriCoveredByPersistedTreePermission[\s\S]*?\n  }\n/)?.[0] ?? '';

    expect(body).toContain('permissionUri.authority != targetUri.authority');
    expect(body).toContain('tryProviderChildDocumentCheck');
    expect(body).toContain('SafPermissionPolicy.isPersistedGrantCovered');
    expect(body).not.toContain('.toString().startsWith');
  });
});
