package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformSamplingPlanTest {
  @Test fun createsOneOrderedBoundedWindowPerWaveformPoint() {
    val durationUs = 240_000_000L
    val windows = buildWaveformSampleWindows(
      pointCount = 480,
      durationUs = durationUs,
      maxWindowUs = 60_000L,
    )

    assertEquals(480, windows.size)
    assertTrue(windows.first().targetUs >= 0L)
    assertTrue(windows.last().endUs <= durationUs)
    assertTrue(windows.all { it.targetUs < it.endUs })
    assertTrue(windows.zipWithNext().all { (left, right) -> left.targetUs < right.targetUs })
  }

  @Test fun keepsTinyBucketsValidWhenPointCountExceedsDurationUnits() {
    val windows = buildWaveformSampleWindows(pointCount = 8, durationUs = 3L, maxWindowUs = 2L)

    assertEquals(8, windows.size)
    assertTrue(windows.all { it.targetUs in 0L..2L })
    assertTrue(windows.all { it.endUs in 1L..3L })
  }

  @Test fun doesNotOverflowNearLongMaxValue() {
    val durationUs = Long.MAX_VALUE - 10L
    val windows = buildWaveformSampleWindows(pointCount = 480, durationUs = durationUs, maxWindowUs = 60_000L)

    assertEquals(480, windows.size)
    assertTrue(windows.last().targetUs >= windows[windows.lastIndex - 1].targetUs)
    assertTrue(windows.last().endUs <= durationUs)
  }
}
