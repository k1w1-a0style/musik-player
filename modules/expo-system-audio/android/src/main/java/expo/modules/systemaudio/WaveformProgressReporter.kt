package expo.modules.systemaudio

/** Decoded audio position, throttled independently of codec packet frequency. */
internal class WaveformProgressReporter(
  private val durationUs: Long,
  private val emit: (Double) -> Unit,
) {
  private var lastEmissionMs = Long.MIN_VALUE
  private var lastProgress = 0.0

  fun update(positionUs: Long, nowMs: Long) {
    if (durationUs <= 0 || lastProgress >= 1.0) return
    if (lastEmissionMs != Long.MIN_VALUE && nowMs - lastEmissionMs < 200L) return
    val next = (positionUs.toDouble() / durationUs).coerceIn(lastProgress, 0.99)
    lastEmissionMs = nowMs
    lastProgress = next
    emit(next)
  }

  fun complete() { lastProgress = 1.0; emit(1.0) }
}
