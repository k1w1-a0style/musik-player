package expo.modules.systemaudio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.sqrt

/** 35–160 Hz energy from decoded PCM, in 50 ms buckets. No microphone/Visualizer. */
internal class PcmBassEnvelope(private val durationUs: Long) {
  private val count = ceil(durationUs / 50_000.0).toInt().coerceIn(1, 24_000)
  private val bassEnergy = DoubleArray(count)
  private val broadEnergy = DoubleArray(count)
  private val counts = LongArray(count)
  private var low1 = DoubleArray(0)
  private var low2 = DoubleArray(0)
  private var dc = DoubleArray(0)

  fun addPcm16(source: ByteBuffer, presentationTimeUs: Long, sampleRate: Int, channelCount: Int) {
    if (sampleRate <= 0 || channelCount <= 0 || durationUs <= 0) return
    val pcm = source.duplicate().order(ByteOrder.nativeOrder())
    val bytesPerFrame = channelCount * Short.SIZE_BYTES
    val frames = pcm.remaining() / bytesPerFrame
    val firstByte = pcm.position()
    if (low1.size != channelCount) {
      low1 = DoubleArray(channelCount)
      low2 = DoubleArray(channelCount)
      dc = DoubleArray(channelCount)
    }
    val sums = DoubleArray(channelCount)
    // Block averaging supplies anti-aliasing before the small filter runs at
    // about 2 kHz; the waveform decoder still visits the complete audio stream.
    val stride = (sampleRate / 2_000).coerceAtLeast(1)
    val rate = sampleRate.toDouble() / stride
    val lowAlpha = 1.0 - kotlin.math.exp(-2 * PI * 160.0 / rate)
    val dcAlpha = 1.0 - kotlin.math.exp(-2 * PI * 35.0 / rate)
    var frame = 0
    while (frame < frames) {
      val end = (frame + stride).coerceAtMost(frames)
      sums.fill(0.0)
      var broad = 0.0
      for (sampleFrame in frame until end) {
        for (channel in 0 until channelCount) {
          val sample = pcm.getShort(firstByte + sampleFrame * bytesPerFrame + channel * Short.SIZE_BYTES) / 32768.0
          sums[channel] += sample
          broad += sample * sample
        }
      }
      val samples = end - frame
      var bass = 0.0
      for (channel in 0 until channelCount) {
        val sample = sums[channel] / samples
        low1[channel] += lowAlpha * (sample - low1[channel])
        low2[channel] += lowAlpha * (low1[channel] - low2[channel])
        dc[channel] += dcAlpha * (low2[channel] - dc[channel])
        val filtered = low2[channel] - dc[channel]
        bass += filtered * filtered
      }
      val timeUs = (presentationTimeUs.coerceAtLeast(0L) + frame.toLong() * 1_000_000L / sampleRate)
        .coerceAtMost(durationUs - 1)
      val bucket = (timeUs.toDouble() / durationUs * count).toInt().coerceIn(0, count - 1)
      // Preserve bass power in stereo files even when channels are out of phase.
      bassEnergy[bucket] += bass / channelCount
      broadEnergy[bucket] += broad / (samples * channelCount)
      counts[bucket]++
      frame = end
    }
  }

  fun normalizedPoints(): List<Double> {
    if (counts.all { it == 0L }) return emptyList()
    val broad = counts.indices.map { if (counts[it] == 0L) 0.0 else sqrt(broadEnergy[it] / counts[it]) }.sorted()
    // Normalize against the full-band signal so a treble-only file cannot turn
    // its tiny low-frequency residue into artificial full-strength bass beats.
    val reference = (broad[(broad.lastIndex * 0.95).toInt()] * 0.75).coerceAtLeast(0.02)
    return counts.indices.map {
      if (counts[it] == 0L) 0.0 else (sqrt(bassEnergy[it] / counts[it]) / reference).coerceIn(0.0, 1.0)
    }
  }
}
