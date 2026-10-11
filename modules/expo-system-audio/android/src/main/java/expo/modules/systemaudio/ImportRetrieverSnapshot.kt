package expo.modules.systemaudio

internal data class ImportRetrieverSnapshot<I, A>(val audio: I?, val artwork: A?, val artworkChecked: Boolean)

/** One scoped data source; optional artwork failures do not discard audio information. */
internal fun <R, I, A> readImportRetrieverSnapshot(
  open: () -> R,
  configure: (R) -> Boolean,
  readAudio: (R) -> I?,
  readArtwork: ((R) -> A?)?,
  release: (R) -> Unit,
): ImportRetrieverSnapshot<I, A> = withResourceReleased(open(), release) { resource ->
  if (!configure(resource)) return@withResourceReleased ImportRetrieverSnapshot(null, null, false)
  val audio = runCatching { readAudio(resource) }.getOrNull()
  val artwork = readArtwork?.let { reader -> runCatching { reader(resource) } }
  ImportRetrieverSnapshot(audio, artwork?.getOrNull(), artwork?.isSuccess == true)
}
