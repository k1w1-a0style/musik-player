'use strict';

const fs = require('fs');

const replaceExactlyOnce = (source, oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label}, found ${count}`);
  return source.replace(oldText, newText);
};

const sourcePath = 'modules/expo-system-audio/android/src/main/java/expo/modules/systemaudio/saf/AudioTagTransaction.kt';
let source = fs.readFileSync(sourcePath, 'utf8');
source = replaceExactlyOnce(
  source,
  `class TransactionStorage(\n  private val root: File,\n  private val directorySync: DirectoryDurabilitySync = AndroidDirectoryDurabilitySync,\n) {`,
  `class TransactionStorage(\n  private val root: File,\n  private val directorySync: DirectoryDurabilitySync = AndroidDirectoryDurabilitySync,\n  private val availableBytesProvider: (File) -> Long = { directory ->\n    StatFs(directory.absolutePath).availableBytes\n  },\n) {`,
  'TransactionStorage constructor',
);
source = replaceExactlyOnce(
  source,
  `  fun availableBytes(): Long = try {\n    StatFs(root.absolutePath).availableBytes\n  } catch (_: Throwable) {\n    Long.MAX_VALUE\n  }`,
  `  fun availableBytes(): Long? = try {\n    availableBytesProvider(root).takeIf { it >= 0L }\n  } catch (_: Throwable) {\n    null\n  }`,
  'availableBytes fail-open fallback',
);
source = replaceExactlyOnce(
  source,
  `    if (storage.availableBytes() < expectedSpace) {\n      return@withLock TransactionResult(\n        success = false,\n        errorCode = "InsufficientStorage",\n        message = "Insufficient app-private storage for durable transaction.",\n      )\n    }`,
  `    val availableBytes = storage.availableBytes()\n    if (availableBytes == null) {\n      return@withLock TransactionResult(\n        success = false,\n        errorCode = "InsufficientStorage",\n        message = "App-private storage capacity could not be verified.",\n      )\n    }\n    if (availableBytes < expectedSpace) {\n      return@withLock TransactionResult(\n        success = false,\n        errorCode = "InsufficientStorage",\n        message = "Insufficient app-private storage for durable transaction.",\n      )\n    }`,
  'storage reserve check',
);
fs.writeFileSync(sourcePath, source);

const testPath = 'modules/expo-system-audio/android/src/test/java/expo/modules/systemaudio/saf/AudioTagTransactionRegressionTest.kt';
let tests = fs.readFileSync(testPath, 'utf8');
const marker = `  @Test fun writeIntentJournalFailureDoesNotMutateTargetOrEscapeCleanup() {`;
const addition = `  @Test fun storageCapacityProbeFailureFailsClosedBeforeProviderAccess() {\n    val root = createTempDir(prefix = "saf-storage-probe-failure-")\n    val store = MemoryStore("original".toByteArray())\n    val storage = TransactionStorage(root, NoopDirectorySync) {\n      throw IOException("statfs unavailable")\n    }\n\n    val result = AudioTagTransactionManager(storage, store, 0).write(\n      request("original".toByteArray(), "rewritten".toByteArray()),\n    )\n\n    assertFalse(result.success)\n    assertEquals("InsufficientStorage", result.errorCode)\n    assertTrue(result.message.contains("could not be verified"))\n    assertEquals(0, store.reads)\n    assertEquals(0, store.writes)\n    assertTrue(root.listFiles().isNullOrEmpty())\n  }\n\n`;
tests = replaceExactlyOnce(tests, marker, addition + marker, 'storage capacity regression marker');
fs.writeFileSync(testPath, tests);
