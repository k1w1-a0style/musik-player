package expo.modules.systemaudio

import android.graphics.Bitmap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class NativeMediaReadSafetyTest {
  @Test fun metadataFieldsFailIndependently() {
    assertEquals("Title", readNonBlankMetadata { "Title" })
    assertNull(readNonBlankMetadata { "   " })
    assertNull(readNonBlankMetadata { throw IllegalStateException("broken field") })

    assertEquals(1234L, readPositiveLongMetadata { "1234" })
    assertNull(readPositiveLongMetadata { "0" })
    assertNull(readPositiveLongMetadata { "not-a-number" })
    assertNull(readPositiveLongMetadata { throw IllegalArgumentException("broken numeric field") })
  }

  @Test fun bitmapIsRecycledAfterSuccessfulOperation() {
    val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)

    val result = withBitmapRecycled(bitmap) { "done" }

    assertEquals("done", result)
    assertTrue(bitmap.isRecycled)
  }

  @Test fun bitmapIsRecycledWhenOperationThrows() {
    val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)

    assertThrows(IllegalStateException::class.java) {
      withBitmapRecycled(bitmap) { throw IllegalStateException("palette failed") }
    }

    assertTrue(bitmap.isRecycled)
  }
}
