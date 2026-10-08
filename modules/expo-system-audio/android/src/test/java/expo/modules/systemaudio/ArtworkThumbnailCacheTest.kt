package expo.modules.systemaudio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ArtworkThumbnailCacheTest {
  @get:Rule val temporary = TemporaryFolder()
  private fun source(width: Int = 1024, height: Int = 512): File {
    val file = temporary.newFile()
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    file.outputStream().use { assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    bitmap.recycle()
    assertTrue("Source fixture must contain real encoded PNG bytes", file.length() > 0)
    return file
  }
  private fun cache(directory: File, now: () -> Long = { 1000L }, maxFiles: Int = 256) =
    ArtworkThumbnailCache(directory, { from, to ->
      Files.move(from.toPath(), to.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    }, now, maxFiles)

  @Test fun boundsOutputPreservesOriginalAndReusesVariants() {
    val original = source()
    val bytes = original.readBytes()
    val cache = cache(temporary.newFolder())
    val small = cache.get(original, 128, "")!!
    val bitmap = BitmapFactory.decodeFile(small.absolutePath)
    assertEquals(128, bitmap.width)
    assertEquals(64, bitmap.height)
    bitmap.recycle()
    assertEquals(small, cache.get(original, 128, ""))
    assertNotEquals(small, cache.get(original, 256, ""))
    assertArrayEquals(bytes, original.readBytes())
  }

  @Test fun revisionAndSourceModificationInvalidateDerivedImage() {
    val original = source()
    val cache = cache(temporary.newFolder())
    val first = cache.get(original, 128, "one")!!
    assertNotEquals(first, cache.get(original, 128, "two"))
    original.setLastModified(original.lastModified() + 2000)
    assertNotEquals(first, cache.get(original, 128, "one"))
  }

  @Test fun brokenCacheRepairsAndInvalidSourceFallsBack() {
    val original = source()
    val cache = cache(temporary.newFolder())
    val image = cache.get(original, 128, "")!!
    image.writeText("interrupted")
    assertEquals(image, cache.get(original, 128, ""))
    assertNotNull(BitmapFactory.decodeFile(image.absolutePath))
    val invalid = temporary.newFile().apply { writeText("not an image") }
    assertNull(cache.get(invalid, 128, ""))
  }

  @Test fun cacheTrimsOldVariantsAfterHandoffGrace() {
    val directory = temporary.newFolder()
    var time = 1000L
    val cache = cache(directory, { time }, maxFiles = 1)
    val original = source()
    val first = cache.get(original, 128, "one")!!
    time += 61_000
    val second = cache.get(original, 128, "two")!!
    assertFalse(first.exists())
    assertTrue(second.exists())
    assertTrue(original.exists())
  }
}
