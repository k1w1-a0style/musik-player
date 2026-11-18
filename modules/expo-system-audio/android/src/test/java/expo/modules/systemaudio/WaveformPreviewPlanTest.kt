package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformPreviewPlanTest {
  @Test fun distributesBoundedSamplesAcrossAnHourLongMix() {
    val durationUs = 65 * 60 * 1_000_000L
    val windows = WaveformPreviewPlan.forDuration(durationUs, 1024)
    assertEquals(24, windows.size)
    val bucketUs = durationUs / windows.size
    windows.forEachIndexed { index, window ->
      assertTrue(window.startUs > bucketUs * index)
      assertTrue(window.endUs < bucketUs * (index + 1))
      assertTrue(window.acceptsSeek(window.startUs - 100_000L))
      assertFalse(window.acceptsSeek(window.startUs - 1_000_000L))
      assertFalse(window.acceptsSeek(window.endUs))
    }
    assertEquals(12_000_000L, windows.sumOf { it.endUs - it.startUs })
  }

  @Test fun preservesExactAnalysisForOrdinaryTracks() {
    assertTrue(WaveformPreviewPlan.forDuration(20 * 60 * 1_000_000L, 1024).isEmpty())
    assertTrue(WaveformPreviewPlan.forDuration(Long.MAX_VALUE, 1024).isEmpty())
  }
}
