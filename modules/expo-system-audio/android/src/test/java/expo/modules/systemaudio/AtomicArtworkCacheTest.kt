package expo.modules.systemaudio

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class AtomicArtworkCacheTest {
  @get:Rule val temporaryFolder = TemporaryFolder()

  private fun replaceAtomically(from: File, to: File) {
    Files.move(from.toPath(), to.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
  }

  private fun cache(directory: File) = AtomicArtworkCache(
    directory = directory,
    validateImage = { true },
    atomicReplace = ::replaceAtomically,
  )

  @Test fun contentKeysAvoidLegacyHashCollisionsAndReuseIdenticalContent() {
    val directory = temporaryFolder.newFolder()
    val firstBytes = byteArrayOf(0, 31)
    val secondBytes = byteArrayOf(1, 0)
    assertEquals(firstBytes.contentHashCode(), secondBytes.contentHashCode())
    val cache = cache(directory)
    val first = cache.put(firstBytes, "png")
    val second = cache.put(secondBytes, "png")
    assertTrue(first.name.matches(Regex("[0-9a-f]{64}\\.png")))
    assertFalse(first == second)
    assertEquals(first, cache.put(firstBytes, "png"))
    assertArrayEquals(firstBytes, first.readBytes())
    assertArrayEquals(secondBytes, second.readBytes())
  }

  @Test fun existingTruncatedAndSameLengthCorruptEntriesAreRepaired() {
    val directory = temporaryFolder.newFolder()
    val cache = cache(directory)
    val bytes = byteArrayOf(1, 2, 3, 4)
    val file = cache.put(bytes, "jpg")
    file.writeBytes(byteArrayOf(1, 2))
    assertEquals(file, cache.put(bytes, "jpg"))
    assertArrayEquals(bytes, file.readBytes())
    file.writeBytes(byteArrayOf(4, 3, 2, 1))
    cache.put(bytes, "jpg")
    assertArrayEquals(bytes, file.readBytes())
  }

  @Test fun partialWriteFailureNeverPublishesAFileAndCanBeRetried() {
    val directory = temporaryFolder.newFolder()
    val bytes = byteArrayOf(1, 2, 3, 4)
    val interrupted = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      writeAndSync = { file, source ->
        file.writeBytes(source.copyOfRange(0, 2))
        throw IOException("storage full")
      },
    )
    try {
      interrupted.put(bytes, "jpg")
      fail("The interrupted writer must fail.")
    } catch (_: IOException) {}
    assertTrue(directory.listFiles()!!.isEmpty())
    val completed = cache(directory).put(bytes, "jpg")
    assertArrayEquals(bytes, completed.readBytes())
  }

  @Test fun failedValidationOrRenameLeavesThePreviousFileIntact() {
    val directory = temporaryFolder.newFolder()
    val bytes = byteArrayOf(1, 2, 3, 4)
    val previous = cache(directory).put(bytes, "jpg")
    val damaged = byteArrayOf(9, 9)
    previous.writeBytes(damaged)
    val broken = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = { _, _ -> throw IOException("rename rejected") },
    )
    try {
      broken.put(bytes, "jpg")
      fail("The failed publication must fail.")
    } catch (_: IOException) {}
    assertArrayEquals(damaged, previous.readBytes())
    assertEquals(1, directory.listFiles()!!.size)

    val invalidImage = AtomicArtworkCache(
      directory = directory,
      validateImage = { false },
      atomicReplace = ::replaceAtomically,
    )
    try {
      invalidImage.put(bytes, "jpg")
      fail("Non-decodable images must not be published.")
    } catch (_: IOException) {}
    assertArrayEquals(damaged, previous.readBytes())
    assertEquals(1, directory.listFiles()!!.size)
  }

  @Test fun parallelSameKeyGenerationPublishesOnlyOneCompleteFile() {
    val directory = temporaryFolder.newFolder()
    val bytes = ByteArray(32 * 1024) { (it % 128).toByte() }
    val writes = AtomicInteger()
    val start = CountDownLatch(1)
    // Production may create a helper per Expo extraction. Coordination must
    // therefore span instances, not merely calls on one cache object.
    val caches = (1..8).map {
      AtomicArtworkCache(
        directory = directory,
        validateImage = { true },
        atomicReplace = { from, to -> writes.incrementAndGet(); replaceAtomically(from, to) },
      )
    }
    val executor = Executors.newFixedThreadPool(4)
    try {
      val tasks = caches.map { cache ->
        executor.submit<File> {
          assertTrue(start.await(2, TimeUnit.SECONDS))
          cache.put(bytes, "webp")
        }
      }
      start.countDown()
      val files = tasks.map { it.get(5, TimeUnit.SECONDS) }
      assertEquals(1, files.toSet().size)
      assertEquals(1, writes.get())
      assertEquals(1, directory.listFiles()!!.size)
      assertArrayEquals(bytes, files.first().readBytes())
    } finally {
      executor.shutdownNow()
    }
  }

  @Test fun cleanupProtectsRecentHandoffsAndNeverDeletesUnrelatedFiles() {
    val directory = temporaryFolder.newFolder()
    var clock = 1_000_000L
    val cache = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      maxFiles = 1,
      handoffGraceMs = 100L,
      now = { clock },
    )
    val unrelated = File(directory, "original-music.mp3").apply { writeText("never touch") }
    val abandoned = File(directory, ".pending-artwork-abandoned.tmp").apply {
      writeText("partial")
      setLastModified(1L)
    }
    val first = cache.put(byteArrayOf(1), "jpg")
    clock += 1
    val second = cache.put(byteArrayOf(2), "jpg")
    assertTrue(first.exists())
    assertTrue(second.exists())
    clock += 25L * 60L * 60L * 1000L
    cache.put(byteArrayOf(2), "jpg")
    assertFalse(first.exists())
    assertFalse(abandoned.exists())
    assertTrue(second.exists())
    assertEquals("never touch", unrelated.readText())
  }

  @Test fun activeLeaseSurvivesAgeAndQuotaUntilItsCopyConsumerReleasesIt() {
    val directory = temporaryFolder.newFolder()
    var clock = 1_000_000L
    val owner = ArtworkCacheLeaseOwner()
    val cache = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      maxFiles = 1,
      handoffGraceMs = 0,
      now = { clock },
    )
    val leased = cache.putLeased(byteArrayOf(1), "jpg", owner)
    clock += 10L * 60L * 1000L
    val newest = cache.put(byteArrayOf(2), "jpg")
    assertTrue(leased.file.exists())
    assertTrue(newest.exists())
    assertFalse(AtomicArtworkCache.releaseLease(ArtworkCacheLeaseOwner(), leased.leaseId))
    assertTrue(AtomicArtworkCache.releaseLease(owner, leased.leaseId))
    assertFalse(leased.file.exists())
    assertTrue(newest.exists())
    assertFalse(AtomicArtworkCache.releaseLease(owner, leased.leaseId))
  }

  @Test fun sharedContentStaysPinnedUntilEveryOwnerFinishesItsHandoff() {
    val directory = temporaryFolder.newFolder()
    var clock = 1_000_000L
    val firstOwner = ArtworkCacheLeaseOwner()
    val secondOwner = ArtworkCacheLeaseOwner()
    val cache = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      maxFiles = 1,
      handoffGraceMs = 0,
      now = { clock },
    )
    val first = cache.putLeased(byteArrayOf(1), "jpg", firstOwner)
    val second = cache.putLeased(byteArrayOf(1), "jpg", secondOwner)
    assertEquals(first.file, second.file)
    assertFalse(first.leaseId == second.leaseId)
    clock += 10L * 60L * 1000L
    cache.put(byteArrayOf(2), "jpg")
    AtomicArtworkCache.closeOwner(firstOwner)
    assertTrue(first.file.exists())
    assertTrue(AtomicArtworkCache.releaseLease(secondOwner, second.leaseId))
    assertFalse(first.file.exists())
    assertFalse(AtomicArtworkCache.releaseLease(firstOwner, first.leaseId))
  }

  @Test fun destroyDuringPublicationReleasesOwnershipAndBlocksLateExtraction() {
    val directory = temporaryFolder.newFolder()
    val owner = ArtworkCacheLeaseOwner()
    val enteredWrite = CountDownLatch(1)
    val finishWrite = CountDownLatch(1)
    val closeAttempted = CountDownLatch(1)
    val cache = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      writeAndSync = { file, bytes ->
        enteredWrite.countDown()
        assertTrue(finishWrite.await(2, TimeUnit.SECONDS))
        file.writeBytes(bytes)
      },
    )
    val executor = Executors.newFixedThreadPool(2)
    try {
      val publishing = executor.submit<LeasedArtworkCacheEntry> { cache.putLeased(byteArrayOf(1), "jpg", owner) }
      assertTrue(enteredWrite.await(2, TimeUnit.SECONDS))
      val closing = executor.submit {
        closeAttempted.countDown()
        AtomicArtworkCache.closeOwner(owner)
      }
      assertTrue(closeAttempted.await(2, TimeUnit.SECONDS))
      assertFalse(closing.isDone)
      finishWrite.countDown()
      val published = publishing.get(2, TimeUnit.SECONDS)
      closing.get(2, TimeUnit.SECONDS)
      assertFalse(AtomicArtworkCache.releaseLease(owner, published.leaseId))
      val entryCount = directory.listFiles()!!.size
      try {
        cache.putLeased(byteArrayOf(2), "jpg", owner)
        fail("Late native extraction must not resurrect a destroyed owner.")
      } catch (_: IllegalStateException) {}
      assertEquals(entryCount, directory.listFiles()!!.size)
    } finally {
      finishWrite.countDown()
      executor.shutdownNow()
    }
  }

  @Test fun lateOldReleaseCannotUnpinANewerReceiptForTheSameCover() {
    val directory = temporaryFolder.newFolder()
    var clock = 1_000_000L
    val owner = ArtworkCacheLeaseOwner()
    val cache = AtomicArtworkCache(
      directory = directory,
      validateImage = { true },
      atomicReplace = ::replaceAtomically,
      maxFiles = 1,
      handoffGraceMs = 0,
      now = { clock },
    )
    val first = cache.putLeased(byteArrayOf(1), "jpg", owner)
    val second = cache.putLeased(byteArrayOf(1), "jpg", owner)
    clock += 10L * 60L * 1000L
    cache.put(byteArrayOf(2), "jpg")
    assertTrue(AtomicArtworkCache.releaseLease(owner, first.leaseId))
    assertFalse(AtomicArtworkCache.releaseLease(owner, first.leaseId))
    assertTrue(second.file.exists())
    assertTrue(AtomicArtworkCache.releaseLease(owner, second.leaseId))
    assertFalse(second.file.exists())
  }
}
