package expo.modules.systemaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class SerializedSessionEffectTest {
  private class FakeEffect(val session: Int) {
    val released = AtomicBoolean(false)
  }

  @Test fun sessionReplacementReleasesExactlyOneOwnerAndRejectsInvalidSessions() {
    val releases = AtomicInteger()
    val controller = SerializedSessionEffect(
      create = { session: Int -> FakeEffect(session) },
      dispose = { effect -> effect.released.set(true); releases.incrementAndGet() },
    )
    val first = controller.initialize(17) { it }!!
    assertEquals(first, controller.initialize(17) { it })
    assertNull(controller.initialize(0) { it })
    assertFalse(first.released.get())
    val second = controller.initialize(23) { it }!!
    assertTrue(first.released.get())
    assertFalse(second.released.get())
    assertEquals(23, second.session)
    assertEquals(1, releases.get())
    controller.release()
    controller.release()
    assertEquals(2, releases.get())
    assertNull(controller.use { it.session })
  }

  @Test fun releaseCannotInterleaveWithAnActiveSliderWrite() {
    val controller = SerializedSessionEffect(
      create = { session: Int -> FakeEffect(session) },
      dispose = { it.released.set(true) },
    )
    val effect = controller.initialize(17) { it }!!
    val enteredWrite = CountDownLatch(1)
    val finishWrite = CountDownLatch(1)
    val releaseAttempted = CountDownLatch(1)
    val releaseCompleted = CountDownLatch(1)
    val executor = Executors.newFixedThreadPool(2)
    try {
      val writing = executor.submit<Boolean> {
        controller.use {
          enteredWrite.countDown()
          assertTrue(finishWrite.await(2, TimeUnit.SECONDS))
          assertFalse(it.released.get())
          true
        } ?: false
      }
      assertTrue(enteredWrite.await(2, TimeUnit.SECONDS))
      val releasing = executor.submit {
        releaseAttempted.countDown()
        controller.release()
        releaseCompleted.countDown()
      }
      assertTrue(releaseAttempted.await(2, TimeUnit.SECONDS))
      assertFalse(releaseCompleted.await(50, TimeUnit.MILLISECONDS))
      finishWrite.countDown()
      assertTrue(writing.get(2, TimeUnit.SECONDS))
      releasing.get(2, TimeUnit.SECONDS)
      assertTrue(effect.released.get())
    } finally {
      finishWrite.countDown()
      executor.shutdownNow()
    }
  }

  @Test fun destroyDisposesAnInFlightInitAndBlocksLateQueuedInit() {
    val created = AtomicInteger()
    val enteredInit = CountDownLatch(1)
    val finishInit = CountDownLatch(1)
    val destroyAttempted = CountDownLatch(1)
    val controller = SerializedSessionEffect(
      create = { session: Int -> created.incrementAndGet(); FakeEffect(session) },
      dispose = { it.released.set(true) },
    )
    val executor = Executors.newFixedThreadPool(2)
    try {
      val initializing = executor.submit<FakeEffect?> {
        controller.initialize(17) {
          enteredInit.countDown()
          assertTrue(finishInit.await(2, TimeUnit.SECONDS))
          it
        }
      }
      assertTrue(enteredInit.await(2, TimeUnit.SECONDS))
      val destroying = executor.submit {
        destroyAttempted.countDown()
        controller.destroy()
      }
      assertTrue(destroyAttempted.await(2, TimeUnit.SECONDS))
      finishInit.countDown()
      val effect = initializing.get(2, TimeUnit.SECONDS)!!
      destroying.get(2, TimeUnit.SECONDS)
      assertTrue(effect.released.get())
      assertNull(controller.initialize(23) { it })
      assertNull(controller.use { it })
      assertEquals(1, created.get())
    } finally {
      finishInit.countDown()
      executor.shutdownNow()
    }
  }

  @Test fun failedInspectionAndReleaseStillLeaveTheControllerUnavailable() {
    val failures = mutableListOf<String>()
    val controller = SerializedSessionEffect(
      create = { session: Int -> FakeEffect(session) },
      dispose = { _: FakeEffect -> throw IllegalStateException("driver release failed") },
      onFailure = { operation, _ -> failures.add(operation); Unit },
    )
    assertNull(controller.initialize<Int>(17) { throw IllegalStateException("driver inspection failed") })
    assertNull(controller.use { it })
    assertEquals(listOf("inspect", "release"), failures)
    assertEquals(23, controller.initialize(23) { it.session })
  }
}
