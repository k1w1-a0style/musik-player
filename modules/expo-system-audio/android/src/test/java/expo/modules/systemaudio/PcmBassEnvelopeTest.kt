package expo.modules.systemaudio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.sin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PcmBassEnvelopeTest {
  @Test fun silenceDoesNotInventBeats() {
    val envelope = PcmBassEnvelope(1_000_000)
    envelope.addPcm16(pcm(48_000) { 0.0 }, 0, 48_000, 1)
    assertTrue(envelope.normalizedPoints().all { it == 0.0 })
  }

  @Test fun bassRespondsWhileEquallyLoudTrebleDoesNot() {
    val bass = analyze(80.0).drop(4).average()
    val treble = analyze(2_000.0).drop(4).average()
    assertTrue("80 Hz energy was lost: $bass", bass > 0.6)
    assertTrue("Treble was misreported as bass: $treble", treble < 0.08)
  }

  @Test fun bucketTimesFollowTheAudioAndKeepSilenceQuiet() {
    val envelope = PcmBassEnvelope(2_000_000)
    envelope.addPcm16(pcm(48_000) { 0.7 * sin(2 * PI * 80 * it / 48_000) }, 1_000_000, 48_000, 1)
    val points = envelope.normalizedPoints()
    assertEquals(40, points.size)
    assertTrue(points.take(20).all { it == 0.0 })
    assertTrue(points.drop(24).average() > 0.6)
  }

  @Test fun splitPcmBuffersPreserveTheEnvelope() {
    val whole = PcmBassEnvelope(1_000_000)
    val split = PcmBassEnvelope(1_000_000)
    val tone: (Int) -> Double = { 0.7 * sin(2 * PI * 80 * it / 48_000) }
    whole.addPcm16(pcm(48_000, tone), 0, 48_000, 1)
    repeat(10) { block ->
      split.addPcm16(pcm(4_800) { tone(it + block * 4_800) }, block * 100_000L, 48_000, 1)
    }
    whole.normalizedPoints().zip(split.normalizedPoints()).forEach { (a, b) -> assertEquals(a, b, 0.01) }
  }

  @Test fun oppositeStereoChannelsDoNotCancelBassPower() {
    val stereo = ByteBuffer.allocate(48_000 * 4).order(ByteOrder.nativeOrder()).apply {
      repeat(48_000) {
        val sample = (0.7 * sin(2 * PI * 80 * it / 48_000) * 32767).toInt()
        putShort(sample.toShort())
        putShort((-sample).toShort())
      }
      flip()
    }
    val envelope = PcmBassEnvelope(1_000_000)
    envelope.addPcm16(stereo, 0, 48_000, 2)
    assertTrue(envelope.normalizedPoints().drop(4).average() > 0.6)
  }

  private fun analyze(hz: Double): List<Double> {
    val envelope = PcmBassEnvelope(1_000_000)
    envelope.addPcm16(pcm(48_000) { 0.7 * sin(2 * PI * hz * it / 48_000) }, 0, 48_000, 1)
    return envelope.normalizedPoints()
  }

  private fun pcm(frames: Int, sample: (Int) -> Double): ByteBuffer = ByteBuffer
    .allocate(frames * 2).order(ByteOrder.nativeOrder()).apply {
      repeat(frames) { putShort((sample(it) * 32767).toInt().toShort()) }
      flip()
    }
}
