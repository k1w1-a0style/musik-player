package expo.modules.systemaudio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PcmWaveformEnvelopeTest {
  @Test fun decodedSilenceStaysFlatWhileAudiblePcmProducesARealPeak() {
    val envelope = PcmWaveformEnvelope(pointCount = 2, durationUs = 1_000_000L)

    envelope.addPcm16(pcm16(ShortArray(200) { 0 }), presentationTimeUs = 0L,
      sampleRate = 200, channelCount = 1)
    envelope.addPcm16(pcm16(ShortArray(100) { 24_000 }), presentationTimeUs = 500_000L,
      sampleRate = 200, channelCount = 1)

    val points = envelope.normalizedPoints()
    assertEquals(0.04, points[0], 0.0001)
    assertEquals(1.0, points[1], 0.0001)
  }

  @Test fun bucketsFollowPresentationTimeInsteadOfCompressedPacketSize() {
    val envelope = PcmWaveformEnvelope(pointCount = 4, durationUs = 4_000_000L)
    envelope.addPcm16(pcm16(shortArrayOf(12_000, -12_000)), presentationTimeUs = 2_000_000L,
      sampleRate = 1, channelCount = 1)

    val points = envelope.normalizedPoints()
    assertEquals(0.04, points[0], 0.0001)
    assertEquals(0.04, points[1], 0.0001)
    assertTrue(points[2] > 0.9)
    assertTrue(points[3] > 0.9)
  }

  private fun pcm16(samples: ShortArray): ByteBuffer = ByteBuffer
    .allocate(samples.size * Short.SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .apply {
      samples.forEach { putShort(it) }
      flip()
    }
}
