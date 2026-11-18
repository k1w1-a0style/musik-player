package expo.modules.systemaudio

/** One short sample in each equal time bucket across a long recording. */
internal object WaveformPreviewPlan {
  const val MAX_EXACT_DURATION_MS = 20 * 60 * 1000L
  const val MAX_POINTS = 24
  private const val SAMPLE_US = 500_000L
  private const val MAX_SEEK_PREROLL_US = 250_000L

  data class Window(val startUs: Long, val endUs: Long) {
    fun acceptsSeek(positionUs: Long): Boolean =
      positionUs in (startUs - MAX_SEEK_PREROLL_US) until endUs
  }

  fun forDuration(durationUs: Long, requestedPoints: Int): List<Window> {
    val points = requestedPoints.coerceIn(1, MAX_POINTS)
    if (durationUs <= MAX_EXACT_DURATION_MS * 1000L || durationUs > Long.MAX_VALUE / points) return emptyList()
    val bucketUs = durationUs / points
    return List(points) { index ->
      val startUs = bucketUs * index + (bucketUs - SAMPLE_US) / 2
      Window(startUs, startUs + SAMPLE_US)
    }
  }
}
