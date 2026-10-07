package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class NativeMediaReadSafetyTest {
  private class FakeResource {
    var released = false
  }

  @Test fun paletteSamplingBoundsOddLargeAndVeryWideImages() {
    assertEquals(4, calculatePaletteSampleSize(1024, 1024, 256 * 256))
    // 513/2 rounds up to 257 pixels when decoded, exceeding a 256² cap.
    assertEquals(4, calculatePaletteSampleSize(513, 513, 256 * 256))
    assertEquals(1, calculatePaletteSampleSize(128, 128, 256 * 256))
    assertEquals(1, calculatePaletteSampleSize(0, 128, 256 * 256))
    val sample = calculatePaletteSampleSize(Int.MAX_VALUE, 10, 256 * 256)
    val width = (Int.MAX_VALUE.toLong() + sample - 1) / sample
    val height = (10L + sample - 1) / sample
    assertTrue(width * height <= 256 * 256)
  }

  @Test fun metadataFieldsFailIndependently() {
    assertEquals("Title", readNonBlankMetadata { "Title" })
    assertNull(readNonBlankMetadata { "   " })
    assertNull(readNonBlankMetadata { throw IllegalStateException("broken field") })

    assertEquals(1234L, readPositiveLongMetadata { "1234" })
    assertNull(readPositiveLongMetadata { "0" })
    assertNull(readPositiveLongMetadata { "not-a-number" })
    assertNull(readPositiveLongMetadata { throw IllegalArgumentException("broken numeric field") })
  }

  @Test fun resourceIsReleasedAfterSuccessfulOperation() {
    val resource = FakeResource()

    val result = withResourceReleased(
      resource = resource,
      release = { it.released = true },
      operation = { "done" },
    )

    assertEquals("done", result)
    assertTrue(resource.released)
  }

  @Test fun resourceIsReleasedWhenOperationThrows() {
    val resource = FakeResource()

    try {
      withResourceReleased(
        resource = resource,
        release = { it.released = true },
        operation = { throw IllegalStateException("palette failed") },
      )
      fail("Expected the operation error to be propagated.")
    } catch (error: IllegalStateException) {
      assertEquals("palette failed", error.message)
    }

    assertTrue(resource.released)
  }
}
