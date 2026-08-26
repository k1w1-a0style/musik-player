package expo.modules.systemaudio

internal data class WaveformSampleWindow(
  val targetUs: Long,
  val endUs: Long,
)

/**
 * Builds one bounded decode window per visible envelope bucket. Long tracks no
 * longer need to be decoded from byte zero to end-of-stream just to draw a few
 * hundred pixels. Boundaries use quotient/remainder arithmetic to avoid Long
 * overflow for unusual metadata durations.
 */
internal fun buildWaveformSampleWindows(
  pointCount: Int,
  durationUs: Long,
  maxWindowUs: Long,
): List<WaveformSampleWindow> {
  require(pointCount > 0)
  require(durationUs > 0)
  require(maxWindowUs > 0)

  val quotient = durationUs / pointCount
  val remainder = durationUs % pointCount
  fun boundary(index: Int): Long = quotient * index + remainder * index / pointCount

  return List(pointCount) { index ->
    val bucketStart = boundary(index)
    val bucketEnd = boundary(index + 1).coerceAtLeast(bucketStart + 1L).coerceAtMost(durationUs)
    val target = (bucketStart + (bucketEnd - bucketStart) / 2L).coerceAtMost(durationUs - 1L)
    val availableUs = (bucketEnd - target).coerceAtLeast(1L)
    val end = target + minOf(maxWindowUs, availableUs, durationUs - target)
    WaveformSampleWindow(targetUs = target, endUs = end)
  }
}
