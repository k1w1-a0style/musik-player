package expo.modules.systemaudio.saf

import android.net.Uri
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SafTargetIdentityAndStorageTest {
  private object NoopSync : DirectoryDurabilitySync {
    override fun sync(directory: File) = Unit
  }

  private fun tmp(): File = createTempDir(prefix = "saf-identity-storage-")

  @Test fun literalAndPercentEncodedDocumentIdsShareAKey() {
    val literal = Uri.parse("content://provider/document/primary:Music/song.mp3")
    val encoded = Uri.parse("content://provider/document/primary%3AMusic%2Fsong.mp3")
    assertEquals(safTargetKey(literal), safTargetKey(encoded))
  }

  @Test fun distinctDocumentsAndAuthoritiesRemainDistinct() {
    val first = safTargetKey(Uri.parse("content://provider/document/one"))
    assertNotEquals(first, safTargetKey(Uri.parse("content://provider/document/two")))
    assertNotEquals(first, safTargetKey(Uri.parse("content://other/document/one")))
  }

  @Test fun treeAndDocumentFormsForTheSameDocumentShareAKey() {
    val treeDocument = Uri.parse("content://provider/tree/primary%3AMusic/document/primary%3AMusic%2Fsong.mp3")
    val document = Uri.parse("content://provider/document/primary:Music/song.mp3")
    assertEquals(safTargetKey(document), safTargetKey(treeDocument))
  }

  @Test fun unusualAndMalformedUrisFailClosedWithoutThrowing() {
    val unusualOne = safTargetKey(Uri.parse("content://provider/unrecognized/%ZZ/one"))
    val unusualTwo = safTargetKey(Uri.parse("content://provider/another/two"))
    assertEquals(unusualOne, unusualTwo)
    assertEquals(safTargetKey(Uri.EMPTY), safTargetKey(Uri.parse("not a uri")))
  }

  @Test fun rootSyncFailureRemovesOnlyTheNewDirectoryAndAllowsRetry() {
    val root = tmp()
    var fail = true
    val sync = object : DirectoryDurabilitySync {
      override fun sync(directory: File) {
        if (fail) throw IOException("root sync")
      }
    }
    val storage = TransactionStorage(root, sync)
    val error = assertThrows(IOException::class.java) { storage.createDir("stable-operation") }
    assertEquals("directory sync failed", error.message)
    assertFalse(File(root, "stable-operation").exists())

    fail = false
    assertTrue(storage.createDir("stable-operation").isDirectory)
  }

  @Test fun preExistingDirectoryIsNeverDeletedByCreateFailure() {
    val root = tmp()
    val existing = File(root, "existing").apply { mkdir(); File(this, "owned").writeText("keep") }
    val storage = TransactionStorage(root, NoopSync)
    assertThrows(IOException::class.java) { storage.createDir("existing") }
    assertEquals("keep", File(existing, "owned").readText())
  }

  @Test fun cleanupFailureIsSuppressedUnderTheOriginalSyncFailure() {
    val root = tmp()
    val syncFailure = IOException("root sync")
    val storage = TransactionStorage(
      root = root,
      directorySync = object : DirectoryDurabilitySync {
        override fun sync(directory: File) = throw syncFailure
      },
      partialDirectoryDelete = { throw IOException("cleanup") },
    )
    val error = assertThrows(IOException::class.java) { storage.createDir("operation") }
    assertSame(syncFailure, error.cause)
    assertEquals("cleanup", error.suppressed.single().message)
  }

  @Test fun successfulAndIndependentDirectoryCreationRemainUnchanged() {
    val root = tmp()
    val storage = TransactionStorage(root, NoopSync)
    val ready = CountDownLatch(2)
    val start = CountDownLatch(1)
    val created = mutableListOf<File>()
    val threads = listOf("first", "second").map { id ->
      thread {
        ready.countDown()
        start.await(5, TimeUnit.SECONDS)
        val directory = storage.createDir(id)
        synchronized(created) { created += directory }
      }
    }
    assertTrue(ready.await(5, TimeUnit.SECONDS))
    start.countDown()
    threads.forEach { it.join(5_000) }
    assertEquals(setOf("first", "second"), created.map { it.name }.toSet())
    assertTrue(created.all { it.isDirectory && it.parentFile.canonicalFile == root.canonicalFile })
  }
}
