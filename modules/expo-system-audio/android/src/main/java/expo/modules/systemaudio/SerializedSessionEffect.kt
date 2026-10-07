package expo.modules.systemaudio

/**
 * Owns an audio-session effect across Expo's async init and synchronous writes.
 * Every use holds the same lock as replacement/release. Volatile fields alone
 * cannot keep a writer from using a released Android AudioEffect.
 */
internal class SerializedSessionEffect<T : Any>(
  private val create: (Int) -> T,
  private val dispose: (T) -> Unit,
  private val onFailure: (String, Throwable) -> Unit = { _, _ -> },
) {
  private val lock = Any()
  private var effect: T? = null
  private var sessionId: Int? = null
  private var destroyed = false

  fun <R> initialize(audioSessionId: Int, inspect: (T) -> R): R? = synchronized(lock) {
    if (destroyed || audioSessionId <= 0) return@synchronized null
    if (effect == null || sessionId != audioSessionId) {
      releaseLocked()
      try {
        effect = create(audioSessionId)
        sessionId = audioSessionId
      } catch (error: Throwable) {
        onFailure("init", error)
        return@synchronized null
      }
    }
    try {
      effect?.let(inspect)
    } catch (error: Throwable) {
      onFailure("inspect", error)
      releaseLocked()
      null
    }
  }

  fun <R> use(action: (T) -> R): R? = synchronized(lock) {
    if (destroyed) return@synchronized null
    try {
      effect?.let(action)
    } catch (error: Throwable) {
      onFailure("write", error)
      null
    }
  }

  fun release() = synchronized(lock) { releaseLocked() }

  fun destroy() = synchronized(lock) {
    // An eqInit already queued on an Expo worker must not resurrect the effect
    // after OnDestroy has released the last owner.
    destroyed = true
    releaseLocked()
  }

  private fun releaseLocked() {
    val previous = effect
    effect = null
    sessionId = null
    if (previous != null) {
      try {
        dispose(previous)
      } catch (error: Throwable) {
        onFailure("release", error)
      }
    }
  }
}
