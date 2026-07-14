package expo.modules.systemaudio.saf

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SafPermissionPolicyTest {
  @Test fun exactPersistedDocumentGrantRequiresWritePermissionAndMatchingAuthority() {
    assertTrue(
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.DOCUMENT,
        true,
        "com.example.documents",
        "doc-1",
        "com.example.documents",
        "doc-1",
      ),
    )
    assertFalse(
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.DOCUMENT,
        false,
        "com.example.documents",
        "doc-1",
        "com.example.documents",
        "doc-1",
      ),
    )
    assertFalse(
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.DOCUMENT,
        true,
        "com.example.documents",
        "doc-1",
        "com.other.documents",
        "doc-1",
      ),
    )
  }

  @Test fun persistedTreeGrantUsesProviderChildDecisionWhenAvailable() {
    assertTrue(
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.TREE,
        true,
        "com.example.documents",
        "opaque-parent",
        "com.example.documents",
        "opaque-child",
        providerConfirmsChild = true,
      ),
    )
    assertFalse(
      SafPermissionPolicy.isPersistedGrantCovered(
        SafPermissionPolicy.PersistedGrantKind.TREE,
        true,
        "com.example.documents",
        "opaque-parent",
        "com.example.documents",
        "opaque-child",
        providerConfirmsChild = false,
      ),
    )
  }

  @Test fun exactAndNormalExternalStorageTreeDescendantsAreCovered() {
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Music"))
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Music/song.mp3"))
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Music/Album/song.mp3"))
  }

  @Test fun rootExternalStorageTreeGrantCoversDescendantsWithoutSlashAfterColon() {
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:", "primary:"))
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:", "primary:Music/song.mp3"))
    assertTrue(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:", "primary:Music/Album/song.mp3"))
  }

  @Test fun similarExternalStoragePrefixesAreNotCovered() {
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Musicology/song.mp3"))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Musicology"))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "primary:Music2/song.mp3"))
  }

  @Test fun differentExternalStorageVolumesAreNotCovered() {
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", "secondary:Music/song.mp3"))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:", "secondary:Music/song.mp3"))
  }

  @Test fun invalidExternalStorageIdsAreNotCovered() {
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant(null, "primary:Music/song.mp3"))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary:Music", null))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant("primary", "primary:Music/song.mp3"))
    assertFalse(SafPermissionPolicy.isExternalStorageDocumentIdDescendant(":Music", "primary:Music/song.mp3"))
  }

  @Test fun externalStorageFallbackRequiresMatchingKnownAuthority() {
    assertTrue(
      SafPermissionPolicy.fallbackCoversDocumentId(
        SafPermissionPolicy.EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY,
        "primary:",
        SafPermissionPolicy.EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY,
        "primary:Music/song.mp3",
      ),
    )
    assertFalse(
      SafPermissionPolicy.fallbackCoversDocumentId(
        SafPermissionPolicy.EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY,
        "primary:",
        "com.example.documents",
        "primary:Music/song.mp3",
      ),
    )
    assertFalse(
      SafPermissionPolicy.fallbackCoversDocumentId(
        "com.example.documents",
        "primary:",
        SafPermissionPolicy.EXTERNAL_STORAGE_DOCUMENTS_AUTHORITY,
        "primary:Music/song.mp3",
      ),
    )
  }

  @Test fun writableFlagsRequireSupportsWriteOnly() {
    val supportsWrite = 1 shl 1
    val supportsDelete = 1 shl 2

    assertTrue(SafPermissionPolicy.isDocumentWritableFromFlags(supportsWrite, supportsWrite))
    assertTrue(SafPermissionPolicy.isDocumentWritableFromFlags(supportsWrite or supportsDelete, supportsWrite))
    assertFalse(SafPermissionPolicy.isDocumentWritableFromFlags(supportsDelete, supportsWrite))
    assertFalse(SafPermissionPolicy.isDocumentWritableFromFlags(0, supportsWrite))
    assertFalse(SafPermissionPolicy.isDocumentWritableFromFlags(null, supportsWrite))
  }
}
