package expo.modules.systemaudio

import org.junit.Assert.*
import org.junit.Test

class ImportRetrieverSnapshotTest {
  private class Resource { var released = false }

  @Test fun sharedReaderOpensOneSourceInsteadOfTwoAndClosesIt() {
    var opens = 0
    val resources = mutableListOf<Resource>()
    fun open() = Resource().also { opens++; resources.add(it) }
    // Previous separate reads use the same scoped resource contract.
    withResourceReleased(open(), { it.released = true }) { "audio" }
    withResourceReleased(open(), { it.released = true }) { "cover" }
    assertEquals(2, opens)
    opens = 0
    val actual = readImportRetrieverSnapshot(::open, { true }, { "audio" }, { "cover" }, { it.released = true })
    assertEquals(1, opens)
    assertEquals("audio", actual.audio)
    assertEquals("cover", actual.artwork)
    assertTrue(actual.artworkChecked)
    assertTrue(resources.all { it.released })
  }

  @Test fun disabledArtworkIsNeverReadAndAbsenceIsOnlyConfirmedAfterRead() {
    val resource = Resource()
    val disabled = readImportRetrieverSnapshot<Resource, String, String>(
      { resource }, { true }, { "audio" }, null, { it.released = true })
    assertFalse(disabled.artworkChecked)
    val absent = readImportRetrieverSnapshot<Resource, String, String>(
      { Resource() }, { true }, { "audio" }, { null }, { it.released = true })
    assertTrue(absent.artworkChecked)
    assertNull(absent.artwork)
  }

  @Test fun artworkFailureRetainsAudioAndClosesResource() {
    val resource = Resource()
    val actual = readImportRetrieverSnapshot<Resource, String, String>({ resource }, { true }, { "audio" },
      { throw IllegalStateException("unsupported or oversized image") }, { it.released = true })
    assertEquals("audio", actual.audio)
    assertFalse(actual.artworkChecked)
    assertTrue(resource.released)
  }

  @Test fun setupFailureCannotProveAbsenceAndStillReleases() {
    val resource = Resource()
    val actual = readImportRetrieverSnapshot<Resource, String, String>({ resource }, { false },
      { fail("audio must not run"); null }, { fail("artwork must not run"); null }, { it.released = true })
    assertNull(actual.audio)
    assertFalse(actual.artworkChecked)
    assertTrue(resource.released)
  }
}
