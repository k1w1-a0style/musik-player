package expo.modules.medialibrary

import android.Manifest.permission.READ_EXTERNAL_STORAGE
import android.Manifest.permission.READ_MEDIA_AUDIO
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// API36 policy contract only. Not an Android36 device/PackageManager test.
class AudioReadPermissionPolicyContractTest {
  @Test fun android36RequiresAudioAndRejectsLegacyGrant() {
    assertFalse(AudioReadPermissionPolicy.isMissing(36) { it == READ_MEDIA_AUDIO })
    assertTrue(AudioReadPermissionPolicy.isMissing(36) { it == READ_EXTERNAL_STORAGE })
  }
}
