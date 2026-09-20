package com.doublesymmetry.trackplayer.service

/**
 * KotlinAudio 2.1.0 move() inserts upward moves at toIndex - 1 in its metadata
 * list, while ExoPlayer inserts at toIndex. Use the public add/remove APIs,
 * which update both lists together. Never remove the active media source:
 * moving it instead relocates the intervening inactive items around it.
 * MusicService calls this synchronously on the main thread.
 */
internal fun <T> moveQueueItemSafely(
    items: List<T>,
    activeIndex: Int,
    fromIndex: Int,
    toIndex: Int,
    add: (List<T>, Int) -> Unit,
    remove: (List<Int>) -> Unit,
) {
    require(fromIndex in items.indices && toIndex in items.indices) { "Invalid queue move index" }
    if (fromIndex == toIndex) return

    if (fromIndex != activeIndex) {
        val insertAt = if (toIndex > fromIndex) toIndex + 1 else toIndex
        add(listOf(items[fromIndex]), insertAt)
        remove(listOf(if (insertAt <= fromIndex) fromIndex + 1 else fromIndex))
    } else if (fromIndex < toIndex) {
        val displaced = items.subList(fromIndex + 1, toIndex + 1).toList()
        add(displaced, fromIndex)
        remove((toIndex + 1..toIndex + displaced.size).toList())
    } else {
        val displaced = items.subList(toIndex, fromIndex).toList()
        add(displaced, fromIndex + 1)
        remove((toIndex until fromIndex).toList())
    }
}
