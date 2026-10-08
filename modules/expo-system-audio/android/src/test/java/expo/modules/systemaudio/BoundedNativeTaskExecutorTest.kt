package expo.modules.systemaudio

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class BoundedNativeTaskExecutorTest {
  private fun await(latch: CountDownLatch) { assertTrue("Native worker did not settle", latch.await(2, TimeUnit.SECONDS)) }

  @Test fun aBlockedReadDoesNotBlockBridgeDispatchOrIndependentServices() {
    val bridge = Executors.newSingleThreadExecutor()
    val reads = BoundedNativeTaskExecutor("test-media", 2)
    val stats = BoundedNativeTaskExecutor("test-stat", 2)
    val thumbnails = BoundedNativeTaskExecutor("test-thumbnail", 2)
    val waveforms = BoundedNativeTaskExecutor("test-waveform", 1, 2)
    val entered = CountDownLatch(2)
    val release = CountDownLatch(1)
    val done = CountDownLatch(2)
    val independent = CountDownLatch(3)
    val results = CopyOnWriteArrayList<Int>()
    try {
      repeat(2) { bridge.execute { reads.submit({ entered.countDown(); release.await(); 0 },
        { done.countDown() }, { _, _ -> done.countDown() }) } }
      await(entered)
      listOf(stats, thumbnails, waveforms).forEachIndexed { index, worker ->
        bridge.execute { worker.submit({ index }, { results.add(it); independent.countDown() }, { _, _ -> independent.countDown() }) }
      }
      await(independent)
      assertEquals(listOf(0, 1, 2), results.sorted())
      assertEquals(2L, done.count)
    } finally {
      release.countDown(); await(done)
      reads.close(); stats.close(); thumbnails.close(); waveforms.close(); bridge.shutdown()
    }
  }

  @Test fun capacityIsHeldByActualWorkAfterItsCallerHasStoppedWaiting() {
    val worker = BoundedNativeTaskExecutor("test-bound", 2)
    val entered = CountDownLatch(2)
    val release = CountDownLatch(1)
    val done = CountDownLatch(2)
    val failures = CopyOnWriteArrayList<NativeTaskFailure>()
    val excessStarts = AtomicInteger()
    try {
      repeat(2) { worker.submit({ entered.countDown(); release.await() }, { done.countDown() }, { _, _ -> done.countDown() }) }
      await(entered)
      repeat(10) { worker.submit({ excessStarts.incrementAndGet() }, {}, { reason, _ -> failures.add(reason) }) }
      assertEquals(0, excessStarts.get())
      assertEquals(List(10) { NativeTaskFailure.CAPACITY }, failures.toList())
      assertEquals(2L, done.count)
    } finally { release.countDown(); await(done); worker.close() }
  }

  @Test fun shutdownSettlesQueuedWorkWithoutInterruptingTheAcceptedRawMutation() {
    val worker = BoundedNativeTaskExecutor("test-transaction", 1, 1)
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val done = CountDownLatch(1)
    val outcomes = CopyOnWriteArrayList<String>()
    try {
      worker.submit({ entered.countDown(); release.await(); "raw-success" },
        { outcomes.add(it); done.countDown() }, { reason, _ -> outcomes.add(reason.name); done.countDown() })
      await(entered)
      worker.submit({ "queued-mutation" }, { outcomes.add(it) }, { reason, _ -> outcomes.add(reason.name) })
      worker.close()
      assertEquals(listOf("CLOSED"), outcomes.toList())
      assertEquals(1L, done.count)
      worker.submit({ "new-mutation" }, { outcomes.add(it) }, { reason, _ -> outcomes.add(reason.name) })
      release.countDown(); await(done)
      assertEquals(listOf("CLOSED", "CLOSED", "raw-success"), outcomes.toList())
    } finally { release.countDown(); worker.close() }
  }

  @Test fun aConstructorFailureSettlesOnceAndDoesNotKillFollowingQueuedWork() {
    val worker = BoundedNativeTaskExecutor("test-failure", 1, 1)
    val done = CountDownLatch(2)
    val failures = CopyOnWriteArrayList<NativeTaskFailure>()
    val values = CopyOnWriteArrayList<Int>()
    try {
      worker.submit<Int>({ throw IllegalStateException("Resource constructor failed") },
        { values.add(it); done.countDown() }, { reason, _ -> failures.add(reason); done.countDown() })
      worker.submit({ 42 }, { values.add(it); done.countDown() }, { reason, _ -> failures.add(reason); done.countDown() })
      await(done)
      assertEquals(listOf(NativeTaskFailure.OPERATION), failures.toList())
      assertEquals(listOf(42), values.toList())
    } finally { worker.close() }
  }
}
