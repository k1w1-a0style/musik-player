package expo.modules.systemaudio

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID

/** Lifecycle token for one Expo module; all state is guarded by the cache lock. */
internal class ArtworkCacheLeaseOwner {
  internal var destroyed = false
}

internal data class LeasedArtworkCacheEntry(val file: File, val leaseId: String)

/** Content-addressed staging cache. Permanent JS cover storage keeps its own leases. */
internal class AtomicArtworkCache(
  private val directory: File,
  private val validateImage: (File) -> Boolean,
  private val atomicReplace: (File, File) -> Unit,
  private val maxEntryBytes: Long = 2L * 1024L * 1024L,
  private val maxFiles: Int = 200,
  private val maxCacheBytes: Long = 25L * 1024L * 1024L,
  private val handoffGraceMs: Long = 60_000L,
  private val now: () -> Long = System::currentTimeMillis,
  private val writeAndSync: (File, ByteArray) -> Unit = { file, bytes ->
    FileOutputStream(file).use { stream ->
      stream.write(bytes)
      stream.fd.sync()
    }
  },
  private val onCleanupFailure: (Throwable) -> Unit = {},
) {
  fun put(bytes: ByteArray, extension: String): File = synchronized(cacheLock) {
    val file = getOrCreate(bytes, extension)
    trim(file, now())
    file
  }

  fun putLeased(bytes: ByteArray, extension: String, owner: ArtworkCacheLeaseOwner): LeasedArtworkCacheEntry = synchronized(cacheLock) {
    check(!owner.destroyed) { "Artwork cache owner has been destroyed." }
    val file = getOrCreate(bytes, extension)
    val leaseId = UUID.randomUUID().toString()
    activeLeases[leaseId] = LeaseRecord(owner, this, file.canonicalPath)
    trim(file, now())
    LeasedArtworkCacheEntry(file, leaseId)
  }

  /** Called only while the global publication/lease/cleanup lock is held. */
  private fun getOrCreate(bytes: ByteArray, extension: String): File {
    require(bytes.isNotEmpty() && bytes.size.toLong() <= maxEntryBytes) { "Artwork exceeds the cache entry budget." }
    require(extension in setOf("jpg", "png", "webp")) { "Unsupported artwork extension." }
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Artwork cache directory is unavailable.")
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    val key = digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    val destination = File(directory, "$key.$extension")

    // Existence alone is insufficient: interrupted legacy writes and damaged
    // cache entries must be replaced rather than returned forever.
    if (!matchesContent(destination, bytes.size.toLong(), digest)) {
      val temporary = File.createTempFile(TEMP_PREFIX, ".tmp", directory)
      try {
        writeAndSync(temporary, bytes)
        if (!matchesContent(temporary, bytes.size.toLong(), digest)) {
          throw IOException("Artwork cache validation failed.")
        }
        // Android's caller uses Os.rename: both paths are on the same filesystem
        // and readers see the complete previous file or the complete new file.
        atomicReplace(temporary, destination)
      } finally {
        if (temporary.exists() && !temporary.delete()) {
          onCleanupFailure(IOException("Artwork staging cleanup failed."))
        }
      }
    }
    val accessTime = now()
    destination.setLastModified(accessTime)
    return destination
  }

  private fun matchesContent(file: File, size: Long, expectedDigest: ByteArray): Boolean {
    if (!file.isFile || file.length() != size || file.canonicalFile.parentFile != directory.canonicalFile) return false
    return try {
      val digest = MessageDigest.getInstance("SHA-256")
      file.inputStream().buffered().use { stream ->
        val buffer = ByteArray(16 * 1024)
        while (true) {
          val count = stream.read(buffer)
          if (count < 0) break
          if (count > 0) digest.update(buffer, 0, count)
        }
      }
      MessageDigest.isEqual(expectedDigest, digest.digest()) && validateImage(file)
    } catch (_: IOException) {
      false
    }
  }

  private fun trim(returnedFile: File?, accessTime: Long) {
    try {
      val entries = directory.listFiles()?.filter { it.isFile } ?: return
      entries.filter {
        it.name.startsWith(TEMP_PREFIX) && it.name.endsWith(".tmp") &&
          accessTime - it.lastModified() > STALE_TEMP_MS
      }.forEach { remove(it) }
      val cached = entries.filter { CACHE_NAME.matches(it.name) }.sortedByDescending { it.lastModified() }
      val leasedPaths = activeLeases.values.map { it.path }.toSet()
      val protectedFiles = cached.filter {
        it == returnedFile || it.canonicalPath in leasedPaths || accessTime - it.lastModified() <= handoffGraceMs
      }.toSet()
      var keptFiles = protectedFiles.size
      var keptBytes = protectedFiles.sumOf { it.length() }
      cached.filterNot { it in protectedFiles }.forEach { file ->
        val size = file.length()
        if (keptFiles < maxFiles && keptBytes + size <= maxCacheBytes) {
          keptFiles += 1
          keptBytes += size
        } else {
          remove(file)
        }
      }
      // Active handoffs never expire by age. The grace period only protects old
      // clients that do not support receipts. Quotas resume after lease release.
    } catch (error: Throwable) {
      onCleanupFailure(error)
    }
  }

  private fun remove(file: File) {
    if (!file.delete()) onCleanupFailure(IOException("Artwork cache trim failed."))
  }

  companion object {
    private data class LeaseRecord(val owner: ArtworkCacheLeaseOwner, val cache: AtomicArtworkCache, val path: String)
    private val activeLeases = mutableMapOf<String, LeaseRecord>()

    fun releaseLease(owner: ArtworkCacheLeaseOwner, leaseId: String): Boolean = synchronized(cacheLock) {
      val lease = activeLeases[leaseId] ?: return@synchronized false
      if (lease.owner !== owner) return@synchronized false
      activeLeases.remove(leaseId)
      lease.cache.trim(null, lease.cache.now())
      true
    }

    fun closeOwner(owner: ArtworkCacheLeaseOwner) = synchronized(cacheLock) {
      owner.destroyed = true
      val owned = activeLeases.filterValues { it.owner === owner }
      owned.keys.forEach { activeLeases.remove(it) }
      owned.values.map { it.cache }.toSet().forEach { it.trim(null, it.now()) }
    }

    // Includes legacy two-32-bit-hash names so their bounded cache is reclaimed.
    private val CACHE_NAME = Regex("(?:[0-9a-f]{64}|[0-9a-f]{1,8}-[0-9a-f]{1,8})\\.(?:jpg|png|webp)")
    private const val TEMP_PREFIX = ".pending-artwork-"
    private const val STALE_TEMP_MS = 24L * 60L * 60L * 1000L
    // Serialize publication and cleanup across module instances, including
    // concurrent same-key generation. Cache writes are small and infrequent.
    private val cacheLock = Any()
  }
}
