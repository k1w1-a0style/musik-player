package expo.modules.systemaudio

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ArtworkImportIsolationTest {
  @Test fun twoBlockedArtworkReadsLeaveImportCapacityAvailable() {
    val module = SystemAudioModule()
    fun lane(name: String) = SystemAudioModule::class.java.getDeclaredField(name).let {
      it.isAccessible = true
      it.get(module) as BoundedNativeTaskExecutor
    }
    val artwork = lane("artworkReadExecutor")
    val media = lane("mediaReadExecutor")
    val entered = CountDownLatch(2)
    val release = CountDownLatch(1)
    val imported = CountDownLatch(1)
    try {
      repeat(2) {
        artwork.submit({ entered.countDown(); release.await(); true }, {}, { _, _ -> fail("artwork rejected") })
      }
      assertTrue("both artwork operations must really be running", entered.await(5, TimeUnit.SECONDS))
      media.submit({ true }, { imported.countDown() }, { _, _ -> fail("import was starved") })
      assertTrue("import must proceed while artwork is blocked", imported.await(5, TimeUnit.SECONDS))
    } finally {
      release.countDown()
      artwork.close()
      media.close()
    }
  }
}
