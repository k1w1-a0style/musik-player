package expo.modules.systemaudio

import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Process
import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CancellationException
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Fresh extractor/codec every time; no app waveform cache on either side. */
@RunWith(AndroidJUnit4::class)
class ColdWaveformBenchmarkTest {
  private data class Decode(val points: List<Double>, val ms: Long)

  @Test fun compareColdDecodeWithThePreviousLoopAndVerifyAllPoints() {
    val previousPriority = Process.getThreadPriority(Process.myTid())
    Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
    try {
      for (name in listOf("A.mp3", "B.m4a", "C.flac")) {
        val file = fixture(name)
        val baseline = mutableListOf<Long>()
        val candidate = mutableListOf<Long>()
        var maximumDelta = 0.0
        repeat(4) { round ->
          // Alternate first decoder to reduce warm-up/order bias. The OS file
          // cache is shared; this measures uncached analysis, not cold disk I/O.
          val results = mutableMapOf<Boolean, Decode>()
          for (fast in if (round % 2 == 0) listOf(false, true) else listOf(true, false)) {
            results[fast] = decode(file, fast)
          }
          val old = results.getValue(false)
          val fresh = results.getValue(true)
          assertEquals(1024, old.points.size)
          assertEquals(1024, fresh.points.size)
          assertTrue(fresh.points.max() - fresh.points.min() > 0.1)
          maximumDelta = maxOf(maximumDelta, old.points.zip(fresh.points).maxOf { (a, b) -> abs(a - b) })
          baseline.add(old.ms)
          candidate.add(fresh.ms)
        }
        Log.i("WaveformBenchmark", "COLD_WAVEFORM_BENCHMARK " + JSONObject()
          .put("file", name).put("baselineMs", JSONArray(baseline)).put("candidateMs", JSONArray(candidate))
          .put("maxPointDelta", maximumDelta).put("points", 1024).toString())
        assertTrue("PCM envelope changed for $name: $maximumDelta", maximumDelta <= 0.01)
        assertNoCallbackWorker()
      }
    } finally {
      Process.setThreadPriority(previousPriority)
    }
  }

  @Test fun cancellationReleasesTheCodecAndCallbackWorker() {
    val cancellation = AtomicBoolean(false)
    val cancelled = AtomicBoolean(false)
    val worker = Thread {
      try { decode(fixture("A.mp3"), true, cancellation) }
      catch (_: CancellationException) { cancelled.set(true) }
    }
    worker.start()
    try {
      val deadline = SystemClock.elapsedRealtime() + 5_000L
      while (!callbackWorkerAlive() && worker.isAlive && SystemClock.elapsedRealtime() < deadline) {
        Thread.sleep(5L)
      }
      cancellation.set(true)
      worker.join(5_000L)
      assertFalse("Cancellation left the decoder running", worker.isAlive)
      assertTrue("Cancelled decode returned a partial waveform", cancelled.get())
      assertNoCallbackWorker()
    } finally {
      cancellation.set(true)
      worker.join(5_000L)
    }
  }

  private fun decode(file: File, fast: Boolean, cancellation: AtomicBoolean = AtomicBoolean(false)): Decode {
    val started = SystemClock.elapsedRealtime()
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(file.absolutePath)
      val index = (0 until extractor.trackCount).first {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      }
      extractor.selectTrack(index)
      val format = extractor.getTrackFormat(index)
      val mime = requireNotNull(format.getString(MediaFormat.KEY_MIME))
      val durationUs = format.getLong(MediaFormat.KEY_DURATION)
      val points = if (fast) CallbackPcmWaveformDecoder.decode(extractor, format, mime, 1024, durationUs, cancellation)
        else LegacyPcmWaveformDecoder.decode(extractor, format, mime, 1024, durationUs, cancellation)
      return Decode(points, SystemClock.elapsedRealtime() - started)
    } finally { extractor.release() }
  }

  private fun fixture(name: String): File {
    val context = InstrumentationRegistry.getInstrumentation().context
    return File(context.cacheDir, name).also { file ->
      if (!file.exists()) context.assets.open("waveform/$name").use { source ->
        file.outputStream().use { source.copyTo(it) }
      }
    }
  }

  private fun callbackWorkerAlive(): Boolean = Thread.getAllStackTraces().keys.any {
    it.name == "waveform-codec-events" && it.isAlive
  }

  private fun assertNoCallbackWorker() = assertFalse("Callback worker leaked", callbackWorkerAlive())
}
