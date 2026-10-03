package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Test

class WaveformProgressReporterTest {
  @Test fun `progress follows decoded position and is throttled`() {
    val values = mutableListOf<Double>()
    val reporter = WaveformProgressReporter(10_000_000L, values::add)
    reporter.update(1_000_000L, 0L)
    reporter.update(4_000_000L, 100L)
    reporter.update(5_000_000L, 200L)
    assertEquals(listOf(0.1, 0.5), values)
  }

  @Test fun `late timestamps cannot rewind progress or prematurely complete it`() {
    val values = mutableListOf<Double>()
    val reporter = WaveformProgressReporter(10_000_000L, values::add)
    reporter.update(7_500_000L, 0L)
    reporter.update(2_000_000L, 200L)
    reporter.update(Long.MAX_VALUE, 400L)
    reporter.complete()
    reporter.update(9_000_000L, 800L)
    assertEquals(listOf(0.75, 0.75, 0.99, 1.0), values)
  }

  @Test fun `unknown duration supplies no invented percentage`() {
    val values = mutableListOf<Double>()
    WaveformProgressReporter(0L, values::add).update(3L, 0L)
    assertEquals(emptyList<Double>(), values)
  }
}
