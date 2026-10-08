package expo.modules.systemaudio

import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.BlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

internal enum class NativeTaskFailure { CAPACITY, CLOSED, OPERATION }

/**
 * A native lifetime bound, rather than a bound on JavaScript promise waiters.
 * Dispatch is short enough for Expo's shared module queue. Slow providers keep
 * their real worker until they return, even after a JS deadline or teardown.
 */
internal class BoundedNativeTaskExecutor(
  name: String,
  maxWorkers: Int,
  queueCapacity: Int = 0,
  onThreadStart: () -> Unit = {},
) {
  private val lifecycleLock = Any()
  @Volatile private var closed = false
  private val queue: BlockingQueue<Runnable> = if (queueCapacity == 0) {
    SynchronousQueue()
  } else {
    ArrayBlockingQueue(queueCapacity)
  }
  private val executor = ThreadPoolExecutor(
    maxWorkers, maxWorkers, 0L, TimeUnit.MILLISECONDS, queue,
    { task ->
      Thread({
        try { onThreadStart() } catch (_: Throwable) {}
        task.run()
      }, name).apply { isDaemon = true }
    },
  )

  init {
    require(maxWorkers > 0)
    require(queueCapacity >= 0)
  }

  fun <T> submit(
    operation: () -> T,
    onSuccess: (T) -> Unit,
    onFailure: (NativeTaskFailure, Throwable?) -> Unit,
  ) {
    val task = object : PendingTask() {
      override fun runOperation() {
        val value = try {
          operation()
        } catch (error: Throwable) {
          fail(NativeTaskFailure.OPERATION, error)
          return
        }
        settle { onSuccess(value) }
      }

      override fun reportFailure(reason: NativeTaskFailure, error: Throwable?) {
        onFailure(reason, error)
      }
    }
    synchronized(lifecycleLock) {
      if (closed) {
        task.fail(NativeTaskFailure.CLOSED)
      } else {
        try {
          executor.execute(task)
        } catch (_: RejectedExecutionException) {
          task.fail(NativeTaskFailure.CAPACITY)
        }
      }
    }
  }

  /**
   * No interrupt: an accepted SAF mutation must preserve its journal and finish
   * on its raw lifetime. Work which has not started is explicitly settled.
   */
  fun close() {
    val abandoned = mutableListOf<Runnable>()
    synchronized(lifecycleLock) {
      if (closed) return
      closed = true
      executor.shutdown()
      executor.queue.drainTo(abandoned)
    }
    abandoned.forEach { (it as PendingTask).fail(NativeTaskFailure.CLOSED) }
  }

  private abstract inner class PendingTask : Runnable {
    private val settled = AtomicBoolean(false)

    override fun run() {
      if (closed) fail(NativeTaskFailure.CLOSED) else runOperation()
    }

    abstract fun runOperation()
    abstract fun reportFailure(reason: NativeTaskFailure, error: Throwable?)

    fun fail(reason: NativeTaskFailure, error: Throwable? = null) =
      settle { reportFailure(reason, error) }

    fun settle(callback: () -> Unit) {
      if (!settled.compareAndSet(false, true)) return
      // A destroyed JS runtime may reject the callback itself. It must neither
      // kill a worker nor manufacture a second promise settlement.
      try { callback() } catch (_: Throwable) {}
    }
  }
}
