package expo.modules.systemaudio

import com.doublesymmetry.trackplayer.service.moveQueueItemSafely
import org.junit.Assert.*
import org.junit.Test

class SafeQueueMoveTest {
  private data class Track(val id: String, val uri: String, val duration: Int)

  @Test fun everyMovePreservesTheActiveMediaSourceAndMatchesTheRequestedOrder() {
    val songs = listOf(Track("pink", "pink.m4a", 205), Track("low", "low.m4a", 193),
      Track("maniac", "maniac.mp3", 252), Track("messy", "messy.mp3", 216))
    for (active in songs.indices) for (from in songs.indices) for (to in songs.indices) {
      val native = songs.toMutableList()
      val metadata = songs.toMutableList()
      // Identity, not just song ID: duplicate entries must not replace the
      // currently playing native media source even with identical metadata.
      val activeSource = Any()
      val sources = songs.map { Any() }.toMutableList().apply { this[active] = activeSource }
      var activePosition = active
      val expected = songs.toMutableList().apply { add(to, removeAt(from)) }
      moveQueueItemSafely(songs, active, from, to,
        add = { items, index ->
          metadata.addAll(index, items)
          native.addAll(index, items)
          sources.addAll(index, items.map { Any() })
          if (index <= activePosition) activePosition += items.size
          assertEquals(metadata, native)
          assertSame(activeSource, sources[activePosition])
        },
        remove = { indices ->
          for (index in indices.sortedDescending()) {
            assertNotEquals("Must not remove the playing source", activePosition, index)
            metadata.removeAt(index)
            native.removeAt(index)
            sources.removeAt(index)
            if (index < activePosition) activePosition--
            assertEquals(metadata, native)
            assertSame(activeSource, sources[activePosition])
          }
        })
      assertEquals("$from -> $to, active $active", expected, native)
      assertEquals(expected, metadata)
      assertEquals(songs[active], native[activePosition])
      assertSame(activeSource, sources[activePosition])
    }
  }

  @Test fun noOpNeverTouchesThePlayer() {
    moveQueueItemSafely(listOf("a", "b"), 0, 1, 1,
      add = { _, _ -> fail("Unexpected add") }, remove = { fail("Unexpected remove") })
  }

  @Test fun invalidIndicesFailBeforeMutatingAnything() {
    for ((from, to) in listOf(-1 to 0, 0 to -1, 2 to 0, 0 to 2)) {
      try {
        moveQueueItemSafely(listOf("a", "b"), 0, from, to,
          add = { _, _ -> fail("Unexpected add") }, remove = { fail("Unexpected remove") })
        fail("Invalid move was accepted")
      } catch (_: IllegalArgumentException) { }
    }
  }
}
