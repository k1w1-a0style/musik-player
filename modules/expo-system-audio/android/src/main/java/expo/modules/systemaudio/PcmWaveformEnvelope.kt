package expo.modules.systemaudio

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.ceil
import kotlin.math.sqrt

/** Time-bucketed RMS envelope for signed 16-bit interleaved PCM. */
internal class PcmWaveformEnvelope(
  private val pointCount: Int,
  private val durationUs: Long,
) {
  private val energy = DoubleArray(pointCount)
  private val frameCounts = LongArray(pointCount)

  init {
    require(pointCount > 0)
    require(durationUs > 0)
  }

  fun addPcm16(
    source: ByteBuffer,
    presentationTimeUs: Long,
    sampleRate: Int,
    channelCount: Int,
  ) {
    if (sampleRate <= 0 || channelCount <= 0) return
    val pcm = source.duplicate().order(ByteOrder.nativeOrder())
    val bytesPerFrame = channelCount * Short.SIZE_BYTES
    val frameCount = pcm.remaining() / bytesPerFrame
    for (frame in 0 until frameCount) {
      var frameEnergy = 0.0
      repeat(channelCount) {
        val normalized = pcm.short.toDouble() / 32768.0
        frameEnergy += normalized * normalized
      }
      val frameTimeUs = presentationTimeUs.coerceAtLeast(0L) + frame.toLong() * MICROS_PER_SECOND / sampleRate
      val bucket = ((frameTimeUs.coerceAtMost(durationUs - 1L) * pointCount) / durationUs)
        .toInt()
        .coerceIn(0, pointCount - 1)
      energy[bucket] += frameEnergy / channelCount
      frameCounts[bucket] += 1L
    }
  }

  fun normalizedPoints(): List<Double> {
    if (frameCounts.all { it == 0L }) return emptyList()
    val rms = energy.indices.map { index ->
      if (frameCounts[index] == 0L) 0.0 else sqrt(energy[index] / frameCounts[index])
    }
    val audible = rms.filter { it > SILENCE_EPSILON }.sorted()
    if (audible.isEmpty()) return List(pointCount) { MIN_VISIBLE_POINT }
    val referenceIndex = ceil((audible.size - 1) * NORMALIZATION_PERCENTILE).toInt()
      .coerceIn(0, audible.lastIndex)
    val reference = audible[referenceIndex].coerceAtLeast(SILENCE_EPSILON)
    return rms.map { value ->
      if (value <= SILENCE_EPSILON) MIN_VISIBLE_POINT
      else (value / reference).coerceIn(MIN_VISIBLE_POINT, 1.0)
    }
  }

  private companion object {
    private const val MICROS_PER_SECOND = 1_000_000L
    private const val MIN_VISIBLE_POINT = 0.04
    private const val SILENCE_EPSILON = 1e-7
    private const val NORMALIZATION_PERCENTILE = 0.95
  }
}
