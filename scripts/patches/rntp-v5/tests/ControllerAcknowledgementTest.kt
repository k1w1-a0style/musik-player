package com.doublesymmetry.trackplayer

import android.os.Looper
import androidx.media3.session.MediaController
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.SettableFuture
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
@LooperMode(LooperMode.Mode.PAUSED)
class ControllerAcknowledgementTest {
  private val media = mockk<MediaController>(relaxed = true)
  private val connected = SettableFuture.create<MediaController>()
  private var listener: MediaController.Listener? = null
  private val controller = MainThreadMediaController()

  private fun start(configuration: ListenableFuture<SessionResult> = success()) {
    every { media.sendCustomCommand(any(), any()) } returns success()
    controller.connect(
      { value -> listener = value; connected },
      { configuration },
      {},
      {},
    )
    connected.set(media)
    shadowOf(Looper.getMainLooper()).idle()
  }

  private fun success(): ListenableFuture<SessionResult> =
    Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))

  @Test
  fun readinessWaitsForNativeConfigurationAcknowledgement() {
    val configuration = SettableFuture.create<SessionResult>()
    start(configuration)
    val outcomes = mutableListOf<Throwable?>()
    controller.awaitReady { outcomes.add(it) }
    assertTrue(outcomes.isEmpty())
    configuration.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf<Throwable?>(null), outcomes)
    assertSame(media, controller.get())
  }

  @Test
  fun configurationFailureRejectsReadinessAndReleasesController() {
    val configuration = SettableFuture.create<SessionResult>()
    start(configuration)
    val outcomes = mutableListOf<Throwable?>()
    controller.awaitReady { outcomes.add(it) }
    configuration.set(SessionResult(SessionError.ERROR_BAD_VALUE))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, outcomes.size)
    assertNotNull(outcomes.single())
    assertNull(controller.get())
    verify(exactly = 1) { media.release() }
  }

  @Test
  fun fenceWaitsForEarlierTransportFutureAndItsOwnNativeBarrier() {
    start()
    val transport = SettableFuture.create<SessionResult>()
    val barrier = SettableFuture.create<SessionResult>()
    every { media.sendCustomCommand(any(), any()) } returns barrier
    val outcomes = mutableListOf<Throwable?>()
    controller.enqueueResult("play") { transport }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    assertTrue(outcomes.isEmpty())
    verify(exactly = 0) { media.sendCustomCommand(any(), any()) }
    transport.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertTrue(outcomes.isEmpty())
    barrier.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf<Throwable?>(null), outcomes)
  }

  @Test
  fun aNeverSettlingTransportKeepsFenceAndLaterWriterPending() {
    start()
    val transport = SettableFuture.create<SessionResult>()
    val outcomes = mutableListOf<Throwable?>()
    var laterWriterRan = false
    controller.enqueueResult("seek") { transport }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    controller.enqueue("clear", playerCommand = true) { laterWriterRan = true }
    shadowOf(Looper.getMainLooper()).idleFor(1, TimeUnit.DAYS)
    assertTrue(outcomes.isEmpty())
    assertFalse(laterWriterRan)
    assertSame(media, controller.get())
  }

  @Test
  fun deniedTransportCannotBecomeSuccessfulFence() {
    start()
    val transport = SettableFuture.create<SessionResult>()
    val outcomes = mutableListOf<Throwable?>()
    controller.enqueueResult("pause") { transport }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    transport.set(SessionResult(SessionError.ERROR_BAD_VALUE))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, outcomes.size)
    assertNotNull(outcomes.single())
  }

  @Test
  fun thrownPlayerMutationRejectsFence() {
    start()
    val outcomes = mutableListOf<Throwable?>()
    controller.enqueue("move", playerCommand = true) {
      throw IllegalArgumentException("Queue index is out of range")
    }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, outcomes.size)
    assertEquals("Queue index is out of range", outcomes.single()?.message)
  }

  @Test
  fun playerCommandsWaitForTheMedia3InteractionBarrier() {
    start()
    val barrier = SettableFuture.create<SessionResult>()
    every { media.sendCustomCommand(any(), any()) } returns barrier
    val outcomes = mutableListOf<Throwable?>()
    controller.enqueue("clear", playerCommand = true) { it.clearMediaItems() }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    shadowOf(Looper.getMainLooper()).idle()
    assertTrue(outcomes.isEmpty())
    barrier.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf<Throwable?>(null), outcomes)
  }

  @Test
  fun fenceAcknowledgesOnlyItsPrecedingCommandBatch() {
    start()
    val first = SettableFuture.create<SessionResult>()
    val second = SettableFuture.create<SessionResult>()
    val firstOutcomes = mutableListOf<Throwable?>()
    val secondOutcomes = mutableListOf<Throwable?>()
    controller.enqueueResult("first") { first }
    controller.awaitPlaybackCommands { firstOutcomes.add(it) }
    controller.enqueueResult("second") { second }
    controller.awaitPlaybackCommands { secondOutcomes.add(it) }
    first.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf<Throwable?>(null), firstOutcomes)
    assertTrue(secondOutcomes.isEmpty())
    second.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(listOf<Throwable?>(null), secondOutcomes)
  }

  @Test
  fun disconnectRejectsPendingFenceAndIgnoresLateCompletion() {
    start()
    val transport = SettableFuture.create<SessionResult>()
    val outcomes = mutableListOf<Throwable?>()
    controller.enqueueResult("seek") { transport }
    controller.awaitPlaybackCommands { outcomes.add(it) }
    listener!!.onDisconnected(media)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, outcomes.size)
    assertNotNull(outcomes.single())
    transport.set(SessionResult(SessionResult.RESULT_SUCCESS))
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(1, outcomes.size)
    assertNull(controller.get())
  }

  @Test
  fun missingControllerRejectsReadinessAndFence() {
    val ready = mutableListOf<Throwable?>()
    val fences = mutableListOf<Throwable?>()
    controller.awaitReady { ready.add(it) }
    controller.awaitPlaybackCommands { fences.add(it) }
    assertNotNull(ready.single())
    assertNotNull(fences.single())
  }
}
