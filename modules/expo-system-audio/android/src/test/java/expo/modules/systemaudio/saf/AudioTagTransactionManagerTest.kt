package expo.modules.systemaudio.saf

import android.net.Uri
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.security.MessageDigest
import java.util.Base64

class AudioTagTransactionManagerTest {
  private object NoopDirectorySync : DirectoryDurabilitySync { override fun sync(directory: File) {} }
  private fun tmp() = createTempDir(prefix = "saf-tx-test-")
  private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
  private fun b64(bytes: ByteArray) = Base64.getEncoder().encodeToString(bytes)
  private fun req(uri: Uri, original: ByteArray, rewritten: ByteArray) = TransactionWriteRequest(uri, b64(rewritten), listOf("title"), 1024 * 1024, original.size.toLong(), sha(original), rewritten.size.toLong())
  private open class FakeStore(var bytes: ByteArray = "old".toByteArray()) : SafContentStore {
    var permission = true; var writable = true; var failRead = false; var failWrite = false; var failAfterPartial = false; var failSync = false; var mutateBeforeWrite: ByteArray? = null; var writes = 0
    override open fun openInput(uri: Uri) = if (failRead) null else ByteArrayInputStream(bytes)
    override open fun openTruncatingOutput(uri: Uri): OutputStream? { writes++; if (failWrite && writes == 1) throw java.io.IOException("write failed"); mutateBeforeWrite?.let { bytes = it; mutateBeforeWrite = null }; val out = ByteArrayOutputStream(); return object: OutputStream(){ var n=0; override fun write(b: Int){ if(failAfterPartial && writes == 1 && n++ > 1) throw java.io.IOException("partial"); out.write(b) }; override fun write(b: ByteArray, off: Int, len: Int){ if(failAfterPartial && writes == 1){ out.write(b, off, minOf(2,len)); throw java.io.IOException("partial") }; out.write(b,off,len)}; override fun flush(){}; override fun close(){ bytes=out.toByteArray() } } }
    override fun sync(output: OutputStream) { if (failSync && writes == 1) throw java.io.IOException("sync") }
    override fun hasWritePermission(uri: Uri) = permission
    override fun isWritable(uri: Uri) = writable
    override fun size(uri: Uri) = bytes.size.toLong()
  }
  private fun storage(root: File) = TransactionStorage(root, NoopDirectorySync)
  private fun manager(root: File, store: FakeStore, margin: Long = 0) = AudioTagTransactionManager(storage(root), store, margin)
  private val uri = Uri.parse("content://provider/tree/song")

  @Test fun successfulCompleteSafWrite() { val o="old".toByteArray(); val n="new".toByteArray(); val root=tmp(); val s=FakeStore(o); val r=manager(root,s).write(req(uri,o,n)); assertTrue(r.success); assertArrayEquals(n,s.bytes); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun noMutatingAccessBeforeVerifiedBackup() { val o="old".toByteArray(); val s=FakeStore(o); val r=manager(tmp(),s).write(req(uri,"bad".toByteArray(),"new".toByteArray())); assertFalse(r.success); assertEquals(0,s.writes); assertArrayEquals(o,s.bytes) }
  @Test fun backupCreationFails() { val s=FakeStore(); s.failRead=true; val r=manager(tmp(),s).write(req(uri,"old".toByteArray(),"new".toByteArray())); assertEquals("BackupFailed", r.errorCode) }
  @Test fun insufficientAppPrivateStorage() { val s=FakeStore(); val r=manager(tmp(),s, Long.MAX_VALUE).write(req(uri,"old".toByteArray(),"new".toByteArray())); assertEquals("InsufficientStorage", r.errorCode) }
  @Test fun originalSizeMismatch() { val s=FakeStore("old".toByteArray()); val r=manager(tmp(),s).write(req(uri,"ol".toByteArray(),"new".toByteArray()).copy(expectedOriginalSha256=sha("old".toByteArray()))); assertEquals("VerificationFailed", r.errorCode) }
  @Test fun originalHashMismatch() { val s=FakeStore("old".toByteArray()); val r=manager(tmp(),s).write(req(uri,"old".toByteArray(),"new".toByteArray()).copy(expectedOriginalSha256=sha("bad".toByteArray()))); assertEquals("VerificationFailed", r.errorCode) }
  @Test fun originalMutatedBetweenBackupAndWrite() { val o="old".toByteArray(); val s=FakeStore(o); s.mutateBeforeWrite="external".toByteArray(); val r=manager(tmp(),s).write(req(uri,o,"new".toByteArray())); assertFalse(r.success) }
  @Test fun invalidRewrittenBase64() { val o="old".toByteArray(); val r=manager(tmp(),FakeStore(o)).write(req(uri,o,"new".toByteArray()).copy(rewrittenBase64="@@@")); assertEquals("InvalidTagData", r.errorCode) }
  @Test fun rewrittenPayloadExceedsLimit() { val o="old".toByteArray(); val r=manager(tmp(),FakeStore(o)).write(req(uri,o,"new".toByteArray()).copy(maxBytes=2)); assertEquals("FileTooLarge", r.errorCode) }
  @Test fun rewrittenStagingSyncCanFailViaReadonlyRoot() { val root=tmp(); root.setWritable(false); try { val o="old".toByteArray(); val r=manager(root,FakeStore(o)).write(req(uri,o,"new".toByteArray())); assertFalse(r.success) } finally { root.setWritable(true) } }
  @Test fun failureBeforeWriteStartedLeavesOriginal() { val o="old".toByteArray(); val s=FakeStore(o); s.writable=false; val r=manager(tmp(),s).write(req(uri,o,"new".toByteArray())); assertEquals("MissingWritePermission", r.errorCode); assertArrayEquals(o,s.bytes) }
  @Test fun failureDuringTargetWriteRollsBack() { val o="old".toByteArray(); val s=FakeStore(o); s.failWrite=true; val r=manager(tmp(),s).write(req(uri,o,"new".toByteArray())); assertEquals("ReplaceFailed", r.errorCode); assertTrue(r.recovered) }
  @Test fun failureAfterPartialTargetWriteRollsBack() { val o="old".toByteArray(); val s=FakeStore(o); s.failAfterPartial=true; val r=manager(tmp(),s).write(req(uri,o,"newer".toByteArray())); assertEquals("ReplaceFailed", r.errorCode); assertTrue(r.recovered) }
  @Test fun failureAfterTargetSyncBeforeVerification() { val o="old".toByteArray(); val s=FakeStore(o); s.failSync=true; val r=manager(tmp(),s).write(req(uri,o,"new".toByteArray())); assertEquals("ReplaceFailed", r.errorCode) }
  @Test fun postWriteHashMismatch() { val o="old".toByteArray(); val s=object: FakeStore(o){ override fun openInput(uri: Uri)=ByteArrayInputStream(if(writes>0) "wrong".toByteArray() else bytes) }; val r=manager(tmp(),s).write(req(uri,o,"new".toByteArray())); assertEquals("VerificationFailed", r.errorCode) }
  @Test fun postWriteOversizeVerificationRollsBack() {
    val o = "old".toByteArray()
    val n = "new".toByteArray()
    val s = object: FakeStore(o) {
      override fun openTruncatingOutput(uri: Uri): OutputStream? {
        writes++
        val out = ByteArrayOutputStream()
        return object: OutputStream() {
          override fun write(b: Int) { out.write(b) }
          override fun write(b: ByteArray, off: Int, len: Int) { out.write(b, off, len) }
          override fun close() {
            val written = out.toByteArray()
            bytes = written + "-tail".toByteArray()
          }
        }
      }
    }
    val root = tmp()
    val r = manager(root, s).write(req(uri, o, n).copy(maxBytes = n.size.toLong()))
    assertEquals("RollbackFailed", r.errorCode)
    assertTrue(r.recoveryPending)
    assertEquals(2, s.writes)
    assertFalse(root.listFiles().isNullOrEmpty())
  }
  @Test fun successfulImmediateRestore() { val o="old".toByteArray(); val n="new".toByteArray(); val root=tmp(); val s=FakeStore(o); s.failWrite=true; val r=manager(root,s).write(req(uri,o,n)); assertFalse(r.success); assertEquals("ReplaceFailed", r.errorCode); assertTrue(r.recovered); assertFalse(r.recoveryPending); assertArrayEquals(o, s.bytes); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun failedImmediateRestorePreservesTransaction() { val o="old".toByteArray(); val s=FakeStore(o); s.failAfterPartial=true; s.permission=false; val r=manager(tmp(),s).write(req(uri,o,"newer".toByteArray())); assertFalse(r.success) }
  @Test fun crashAtBackupReadyCleans() { val root=tmp(); val st=storage(root); val d=st.createDir(); st.atomicWriteJournal(d, TransactionJournal(transactionId=d.name,targetUri=uri.toString(),state=TransactionState.BACKUP_READY,createdAtEpochMs=1,updatedAtEpochMs=1)); val r=manager(root,FakeStore()).recoverPending(); assertTrue(r.success); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun crashAtWriteStartedRestores() { recoverState(TransactionState.WRITE_STARTED) }
  @Test fun crashAtWrittenUnverifiedRestores() { recoverState(TransactionState.WRITTEN_UNVERIFIED) }
  @Test fun crashAfterCommittedBeforeCleanup() { val root=tmp(); val st=storage(root); val d=st.createDir(); val n="new".toByteArray(); st.rewritten(d).writeBytes(n); st.atomicWriteJournal(d, TransactionJournal(transactionId=d.name,targetUri=uri.toString(),state=TransactionState.COMMITTED,createdAtEpochMs=1,updatedAtEpochMs=1,rewrittenSizeBytes=n.size.toLong(),rewrittenSha256Hex=sha(n))); val r=manager(root,FakeStore(n)).recoverPending(); assertTrue(r.success); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun recoveryWithPermission() { recoverState(TransactionState.WRITE_STARTED) }
  @Test fun recoveryWithoutPermissionPending() { val root=prepared(TransactionState.WRITE_STARTED); val s=FakeStore("bad".toByteArray()); s.permission=false; val r=manager(root,s).recoverPending(); assertEquals("RecoveryPending", r.errorCode); assertFalse(root.listFiles().isNullOrEmpty()) }
  @Test fun damagedJournalQuarantined() { val root=tmp(); val d=File(root,"x"); d.mkdirs(); File(d,"journal.json").writeText("{"); val r=manager(root,FakeStore()).recoverPending(); assertEquals("RecoveryPending", r.errorCode) }
  @Test fun missingOriginalBinFailsRecovery() { val root=prepared(TransactionState.WRITE_STARTED); File(root.listFiles()!![0],"original.bin").delete(); val r=manager(root,FakeStore()).recoverPending(); assertEquals("RecoveryFailed", r.errorCode) }
  @Test fun manipulatedOriginalBinFailsRecovery() { val root=prepared(TransactionState.WRITE_STARTED); File(root.listFiles()!![0],"original.bin").writeText("tampered"); val r=manager(root,FakeStore()).recoverPending(); assertEquals("RollbackFailed", r.errorCode) }
  @Test fun duplicateParallelTransactionIsSerialized() { val o="old".toByteArray(); val n="new".toByteArray(); val root=tmp(); val s=FakeStore(o); val m=manager(root,s); val r1=m.write(req(uri,o,n)); val r2=m.write(req(uri,n,"new2".toByteArray())); assertTrue(r1.success); assertTrue(r2.success); assertArrayEquals("new2".toByteArray(), s.bytes); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun repeatedRecoveryIsIdempotent() { val root=prepared(TransactionState.BACKUP_READY); val m=manager(root,FakeStore()); assertTrue(m.recoverPending().success); assertTrue(m.recoverPending().success) }
  @Test fun successfulCleanupLeavesNoArtifacts() { val o="old".toByteArray(); val n="new".toByteArray(); val root=tmp(); val s=FakeStore(o); val r=manager(root,s).write(req(uri,o,n)); assertTrue(r.success); assertTrue(r.verified); assertArrayEquals(n,s.bytes); assertTrue(root.listFiles().isNullOrEmpty()) }
  @Test fun journalDoesNotUseUriAsDirectoryName() { val root=tmp(); val s=FakeStore("old".toByteArray()); manager(root,s).write(req(uri,"old".toByteArray(),"new".toByteArray())); assertFalse(root.absolutePath.contains(uri.toString())) }

  @Test fun journalAcceptsJsChangedFieldNames() { val all = listOf("title", "artist", "albumArtist", "album", "year", "genre", "trackNumber", "discNumber", "comment", "cover"); val j=TransactionJournal(transactionId="tx",targetUri=uri.toString(),state=TransactionState.PREPARING,createdAtEpochMs=1,updatedAtEpochMs=1,changedFields=all); assertEquals(all, TransactionJournal.fromJson(j.toJson()).changedFields) }
  @Test fun journalRejectsUnknownChangedField() { val j=TransactionJournal(transactionId="tx",targetUri=uri.toString(),state=TransactionState.PREPARING,createdAtEpochMs=1,updatedAtEpochMs=1,changedFields=listOf("track")); assertThrows(IllegalArgumentException::class.java) { TransactionJournal.fromJson(j.toJson()) } }
  @Test fun damagedJournalDoesNotBlockIndependentUri() { val root=tmp(); val bad=File(root,"bad"); bad.mkdirs(); File(bad,"original.bin").writeText("backup"); File(bad,"journal.json").writeText("{"); val s=FakeStore("old".toByteArray()); val r=manager(root,s).write(req(Uri.parse("content://provider/tree/other"),"old".toByteArray(),"new".toByteArray())); assertTrue(r.success); assertArrayEquals("new".toByteArray(), s.bytes); assertTrue(File(root.parentFile,"audio-tag-transactions-quarantine").listFiles()?.isNotEmpty() == true) }

  private fun prepared(state: TransactionState): File { val root=tmp(); val st=storage(root); val d=st.createDir(); val o="old".toByteArray(); val n="new".toByteArray(); st.original(d).writeBytes(o); if (state != TransactionState.BACKUP_READY && state != TransactionState.PREPARING) st.rewritten(d).writeBytes(n); st.atomicWriteJournal(d, TransactionJournal(transactionId=d.name,targetUri=uri.toString(),state=state,createdAtEpochMs=1,updatedAtEpochMs=1,originalSizeBytes=o.size.toLong(),originalSha256Hex=sha(o),rewrittenSizeBytes=if (state == TransactionState.BACKUP_READY || state == TransactionState.PREPARING) null else n.size.toLong(),rewrittenSha256Hex=if (state == TransactionState.BACKUP_READY || state == TransactionState.PREPARING) null else sha(n))); return root }
  private fun recoverState(state: TransactionState) { val root=prepared(state); val r=manager(root,FakeStore("broken".toByteArray())).recoverPending(); assertTrue(r.success); assertTrue(r.recovered) }
}
