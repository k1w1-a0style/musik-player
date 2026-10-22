package expo.modules.medialibrary

import android.Manifest.permission.READ_EXTERNAL_STORAGE
import android.Manifest.permission.READ_MEDIA_AUDIO

// App-specific read-only policy: this application only queries audio assets.
internal object AudioReadPermissionPolicy {
  fun isMissing(sdk: Int, hasGranted: (String) -> Boolean): Boolean =
    !hasGranted(if (sdk >= 33) READ_MEDIA_AUDIO else READ_EXTERNAL_STORAGE)
}
