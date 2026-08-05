package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeLogTest {
  @Test
  fun `content reference exposes only scheme and short hash`() {
    val raw = "content://com.example.documents/tree/primary%3AMusic/document/primary%3AMusic%2Fsecret-song.mp3?token=private"
    val logged = raw.safeLogReference()

    assertTrue(logged.matches(Regex("scheme=content ref=[0-9a-f]{12}")))
    assertFalse(logged.contains("com.example"))
    assertFalse(logged.contains("primary"))
    assertFalse(logged.contains("secret-song"))
    assertFalse(logged.contains("private"))
  }

  @Test
  fun `reference is stable but distinguishes different targets`() {
    val first = "file:///storage/emulated/0/Music/one.mp3".safeLogReference()
    val repeated = "file:///storage/emulated/0/Music/one.mp3".safeLogReference()
    val second = "file:///storage/emulated/0/Music/two.mp3".safeLogReference()

    assertEquals(first, repeated)
    assertNotEquals(first, second)
    assertTrue(first.startsWith("scheme=file ref="))
    assertFalse(first.contains("storage"))
    assertFalse(first.contains("one.mp3"))
  }

  @Test
  fun `exception logging never includes the message`() {
    val error = IllegalStateException("provider failed at /storage/private/song.mp3")

    assertEquals("IllegalStateException", error.safeLogType())
    assertFalse(error.safeLogType().contains("storage"))
  }
}
