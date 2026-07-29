package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformCancellationRegistryTest {
  @Test fun registeredRequestCanBeCancelledAndRemoved() {
    val registry = WaveformCancellationRegistry()
    val token = registry.register("request-1")

    assertEquals(1, registry.activeCount())
    assertFalse(token.get())
    assertTrue(registry.cancel("request-1"))
    assertTrue(token.get())

    registry.complete("request-1", token)
    assertEquals(0, registry.activeCount())
    assertFalse(registry.cancel("request-1"))
  }

  @Test fun duplicateRequestIdCancelsThePreviousToken() {
    val registry = WaveformCancellationRegistry()
    val first = registry.register("request-1")
    val second = registry.register("request-1")

    assertTrue(first.get())
    assertFalse(second.get())
    assertEquals(1, registry.activeCount())

    registry.complete("request-1", first)
    assertEquals(1, registry.activeCount())
    registry.complete("request-1", second)
    assertEquals(0, registry.activeCount())
  }
}
