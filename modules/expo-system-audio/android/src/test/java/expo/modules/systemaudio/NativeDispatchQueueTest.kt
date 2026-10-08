package expo.modules.systemaudio

import expo.modules.kotlin.functions.BaseAsyncFunctionComponent
import expo.modules.kotlin.functions.Queues
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class NativeDispatchQueueTest {
  @Test fun bridgeIngressDoesNotDependOnLegacyFileSystemsBlockedDefaultQueue() {
    val queue = BaseAsyncFunctionComponent::class.java.getDeclaredField("queue").apply { isAccessible = true }
    val audio = SystemAudioModule().definition().asyncFunctions
    val waveform = SystemAudioWaveformModule().definition().asyncFunctions
    assertEquals(13, audio.size)
    assertEquals(setOf("extractWaveformPeaks"), waveform.keys)
    (audio + waveform).forEach { (name, function) ->
      // Each body only submits to the bounded worker. Actual provider/codec
      // work must never execute on either this ingress queue or Expo's default.
      assertEquals("$name must remain dispatchable while legacy FS is blocked", Queues.MAIN, queue.get(function))
    }
  }
}
