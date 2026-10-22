package expo.modules.medialibrary

import android.Manifest.permission.READ_EXTERNAL_STORAGE
import android.Manifest.permission.READ_MEDIA_AUDIO
import android.Manifest.permission.WRITE_EXTERNAL_STORAGE
import android.app.Application
import android.content.pm.PackageManager
import android.os.Build
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

// Compiles the exact helper installed into Expo, not a duplicate implementation.
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [24, 28, 29, 30, 31, 32, 33, 34, 35])
class AudioReadPermissionPolicyTest {
  private val app: Application get() = RuntimeEnvironment.getApplication()
  private val required: String get() = if (Build.VERSION.SDK_INT >= 33) READ_MEDIA_AUDIO else READ_EXTERNAL_STORAGE
  private fun missing() = AudioReadPermissionPolicy.isMissing(Build.VERSION.SDK_INT) {
    app.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
  }

  @Test fun audioReadWithoutWriteAllowsImport() {
    shadowOf(app).grantPermissions(required)
    assertTrue(app.checkSelfPermission(WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
    assertFalse(missing())
  }

  @Test fun writePermissionAloneCannotAuthorizeRead() {
    shadowOf(app).grantPermissions(WRITE_EXTERNAL_STORAGE)
    assertTrue(missing())
  }

  @Test fun revocationIsObservedWithoutRestartOrCachedGrant() {
    shadowOf(app).grantPermissions(required)
    assertFalse(missing())
    shadowOf(app).denyPermissions(required)
    assertTrue(missing())
  }

  @Test fun absentPermissionManagerFailsClosed() {
    assertTrue(AudioReadPermissionPolicy.isMissing(Build.VERSION.SDK_INT) { false })
  }
}
