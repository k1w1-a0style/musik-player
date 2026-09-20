#!/usr/bin/env python3
"""Exercise the normal dev app on an isolated emulator with generated audio.

Fixture setup seeds storage; all playback, scrubbing and reordering use Android
input events. Never run against a physical device or a production package.
"""
import json
from collections import Counter
from io import BytesIO
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from PIL import Image
import uiautomator2 as u2
from androidSmokeDiagnostics import collect_diagnostics

PACKAGE = os.environ.get('PACKAGE_NAME', 'com.k1w1a0style.musikplayer.dev')
OUT = Path('ci-logs/interaction')
OUT.mkdir(parents=True, exist_ok=True)
startup_retries = 0
launcher_dialogs = 0
device = None


def adb(*args, check=True, data=None):
    return subprocess.run(['adb', *args], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check).stdout


def ui():
    # A scrolling timeline never becomes idle. The shell dump command can fail
    # and leave yesterday's XML behind; use a fresh, non-idle snapshot instead.
    assert device is not None
    raw = device.dump_hierarchy(compressed=False, max_depth=80).encode()
    (OUT / 'latest-ui.xml').write_bytes(raw)
    try:
        return ET.fromstring(raw)
    except ET.ParseError:
        return ET.Element('empty')


def matches(node, key):
    return any(node.get(attr, '') == key or node.get(attr, '').endswith(':id/' + key)
               for attr in ['resource-id', 'text', 'content-desc'])


def find(key, timeout=20):
    global startup_retries, launcher_dialogs
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        tree = ui()
        # Google's launcher can ANR during a cold software-rendered AVD boot.
        # Record and close only this named system app, never a music-app ANR.
        if any(node.get('resource-id') == 'android:id/alertTitle'
               and node.get('text') == "Pixel Launcher isn't responding" for node in tree.iter('node')):
            assert launcher_dialogs == 0, 'Pixel Launcher repeatedly stopped responding'
            screenshot('startup-pixel-launcher-dialog')
            for node in tree.iter('node'):
                if node.get('resource-id') == 'android:id/aerr_close':
                    launcher_dialogs += 1
                    print('Closing the recorded Pixel Launcher system ANR dialog.', flush=True)
                    tap_node(node)
                    break
            continue
        for node in tree.iter('node'):
            if matches(node, key) and node.get('bounds') != '[0,0][0,0]':
                print('Found UI: ' + key, flush=True)
                return node
        # Expo dev-client's first-launch introduction is outside the app.
        for node in tree.iter('node'):
            if node.get('text', '').lower() in ['continue', 'got it']:
                tap_node(node)
        # SDK 54 opens the developer menu after its introduction. Close only
        # that identified menu; do not dismiss an application error dialog.
        if any(node.get('text') == 'Connected to:' for node in tree.iter('node')):
            for node in tree.iter('node'):
                if node.get('content-desc') == 'Close':
                    tap_node(node)
                    break
        if key == 'mini-player-open' and startup_retries == 0:
            for node in tree.iter('node'):
                if matches(node, 'hydration-retry-button'):
                    startup_retries += 1
                    screenshot('startup-before-retry')
                    print('Cold startup degraded; exercising the visible hydration retry once.', flush=True)
                    tap_node(node)
                    break
        time.sleep(0.4)
    raise AssertionError('UI not found: ' + key)


def bounds(node):
    return [int(n) for n in re.findall(r'\d+', node.get('bounds', ''))]


def tap_node(node):
    x1, y1, x2, y2 = bounds(node)
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def tap(key):
    tap_node(find(key))


def swipe(node, backwards=False, duration=350):
    x1, y1, x2, y2 = bounds(node)
    left, right, y = int(x1 + (x2 - x1) * .18), int(x1 + (x2 - x1) * .82), (y1 + y2) // 2
    start, end = (left, right) if backwards else (right, left)
    adb('shell', 'input', 'swipe', str(start), str(y), str(end), str(y), str(duration))


def time_ms(key):
    label = find(key).get('text', '')
    parts = [int(part) for part in label.split(':')]
    return sum(value * (60 ** index) for index, value in enumerate(reversed(parts))) * 1000


def position_ms():
    return time_ms('soundcloud-waveform-current-time')


def assert_native_track(letter, seconds):
    find('Smoke ' + letter)
    # useProgress reads ExoPlayer's decoded duration. MediaSession metadata and
    # getQueue alone both reported the wrong title when KotlinAudio diverged.
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        actual = time_ms('soundcloud-waveform-total-time')
        if abs(actual - seconds * 1000) <= 1000:
            return
        time.sleep(.5)
    raise AssertionError(f'Cover/title {letter} is paired with native duration {actual}, expected {seconds * 1000}')


def drag_row(prefix, source, target, handle_prefix=None):
    row = find(prefix + source)
    handle = find(handle_prefix + source) if handle_prefix else row
    x1, y1, x2, y2 = bounds(handle)
    _, t1, _, t2 = bounds(find(prefix + target))
    x, start, end = (x1 + x2) // 2, (y1 + y2) // 2, (t1 + t2) // 2
    if handle_prefix:
        adb('shell', 'input', 'swipe', str(x), str(start), str(x), str(end), '650')
    else:
        # Keep the same finger down through activation and movement.
        device.touch.down(x, start)
        try:
            time.sleep(.5)
            for step in range(1, 9):
                device.touch.move(x, round(start + (end - start) * step / 8))
                time.sleep(.05)
        finally:
            device.touch.up(x, end)
    time.sleep(.8)


def assert_queue_order(ids):
    positions = [bounds(find('queue-row-smoke-' + letter))[1] for letter in ids]
    assert positions == sorted(positions) and len(set(positions)) == len(ids), f'Wrong queue order: {ids}, {positions}'


def screenshot(name):
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))


def assert_waveform_pixels(pixels, viewport):
    x1, y1, x2, y2 = viewport
    center = (x1 + x2) // 2
    def dominant(left, right, upcoming=False):
        colored = Counter(pixels.getpixel((x, y)) for x in range(left, right)
                          for y in range(y1, y2)
                          if ((min(pixels.getpixel((x, y))) > 170
                               and max(pixels.getpixel((x, y))) - min(pixels.getpixel((x, y))) < 25)
                              if upcoming else max(pixels.getpixel((x, y))) - min(pixels.getpixel((x, y))) > 40))
        assert colored, 'Upcoming waveform must be white; played waveform must retain its accent'
        return colored.most_common(1)[0][0]
    played, future = dominant(x1, center - 6), dominant(center + 6, x2, upcoming=True)
    # Thin SVG strokes are antialiased onto different underlying layers. Check
    # visible brightness contrast, not exact equality to the source RGB color.
    def luminance(color):
        return sum(channel * weight for channel, weight in zip(color, (.2126, .7152, .0722)))
    ratio = luminance(played) / luminance(future)
    assert .15 <= ratio <= .8, f'Played waveform contrast is insufficient: {ratio:.3f}, {played}, {future}'
    white = sum(min(pixels.getpixel((center, y))) >= 230 for y in range(y1, y2))
    assert white > (y2 - y1) * .8, 'The center playhead is not visibly drawn'
    return {'played': played, 'future': future, 'brightnessRatio': round(ratio, 3)}


def assert_waveform_visuals():
    viewport = bounds(find('Waveform vor- oder zurückspulen'))
    raw = adb('exec-out', 'screencap', '-p')
    (OUT / 'waveform-visual-check.png').write_bytes(raw)
    result = assert_waveform_pixels(Image.open(BytesIO(raw)).convert('RGB'), viewport)
    print('Visible playhead and darker played half verified: ' + json.dumps(result), flush=True)


def snapshot_storage():
    with tempfile.TemporaryDirectory() as temp:
        db = Path(temp) / 'RKStorage'
        for suffix in ['', '-wal', '-shm']:
            data = adb('exec-out', 'run-as', PACKAGE, 'cat', 'databases/RKStorage' + suffix, check=False)
            if data:
                Path(str(db) + suffix).write_bytes(data)
        connection = sqlite3.connect(db)
        try:
            return {key: json.loads(value) for key, value in connection.execute('SELECT key, value FROM catalystLocalStorage')}
        finally:
            connection.close()


def wait_waveform(duration_ms):
    deadline = time.monotonic() + 32
    while time.monotonic() < deadline:
        try:
            for key, value in snapshot_storage().items():
                if ':waveform:v6:' not in key or not isinstance(value, dict):
                    continue
                if value.get('source') == 'native' and abs(value.get('durationMs', 0) - duration_ms) < 1500:
                    assert len(value['points']) == 1024, 'APK must contain the new native 1024-point decoder'
                    assert max(value['points']) - min(value['points']) > .1, 'Fixture envelope lost its dynamics'
                    return value
        except sqlite3.DatabaseError:
            pass  # A write may be between the copied main database and WAL.
        time.sleep(.5)
    raise AssertionError('Native waveform was not persisted for duration ' + str(duration_ms))


def prepare():
    global device
    assert PACKAGE.endswith('.dev')
    assert adb('shell', 'getprop', 'ro.kernel.qemu').strip() == b'1', 'Emulator only'
    device = u2.connect()
    device.jsonrpc.setConfigurator({'waitForIdleTimeout': 0, 'waitForSelectorTimeout': 0})
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.READ_MEDIA_AUDIO')
    adb('shell', 'mkdir', '-p', '/sdcard/Music/player-smoke')
    fixtures = OUT / 'fixtures'
    fixtures.mkdir(exist_ok=True)
    songs = []
    for letter, seconds, ext, codec, frequency in [('A', 180, 'mp3', 'libmp3lame', 330), ('B', 90, 'm4a', 'aac', 550), ('C', 120, 'flac', 'flac', 880)]:
        file = fixtures / (letter + '.' + ext)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                        f'aevalsrc=0.5*sin(2*PI*{frequency}*t)*(0.2+0.8*abs(sin(2*PI*t/9))):s=44100:d={seconds}',
                        '-ac', '2', '-c:a', codec, '-threads', '1', str(file)], check=True)
        remote = '/sdcard/Music/player-smoke/' + file.name
        adb('push', str(file), remote)
        uri = 'file://' + remote
        songs.append({'id': 'smoke-' + letter.lower(), 'title': 'Smoke ' + letter, 'artist': 'CI Audio',
                      'uri': uri, 'duration': seconds * 1000,
                      'fileInfo': {'uri': uri, 'size': file.stat().st_size, 'importedAt': 1,
                                   'filename': file.name, 'extension': ext, 'container': ext},
                      'audioInfo': {'codec': codec, 'durationMs': seconds * 1000, 'bitrate': 128000,
                                    'sampleRate': 44100, 'channels': 2},
                      'coverInfo': {'status': 'none', 'embeddedArtworkChecked': True}})
    # The app migrates this supported legacy storage key through its real hydration path.
    database = OUT / 'seed.db'
    if database.exists():
        database.unlink()
    connection = sqlite3.connect(database)
    connection.execute('CREATE TABLE catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    values = {'songs': songs, 'currentSongId': 'smoke-a', 'nowPlayingPlayerLayout': 'soundcloud',
              'playlists': [{'id': 'smoke-list', 'name': 'Smoke Playlist', 'songIds': [s['id'] for s in songs],
                             'createdAt': 1, 'updatedAt': 1}]}
    connection.executemany('INSERT INTO catalystLocalStorage VALUES (?, ?)',
                           [('@musikplayer:' + key, json.dumps(value)) for key, value in values.items()])
    connection.execute('PRAGMA user_version=1')
    connection.commit()
    connection.close()
    adb('shell', 'run-as', PACKAGE, 'mkdir', '-p', 'databases')
    # This script only runs immediately after installation on the disposable AVD.
    adb('shell', 'run-as', PACKAGE, 'sh', '-c', "'rm -f databases/RKStorage*'")
    adb('shell', 'run-as', PACKAGE, 'sh', '-c', "'cat > databases/RKStorage'", data=database.read_bytes())
    adb('reverse', 'tcp:8081', 'tcp:8081')
    adb('logcat', '-c')
    adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d',
        'exp+musik-player://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081', PACKAGE)


def check_playback():
    # Metro serves the normal index.js from the reviewed checkout.
    find('mini-player-open', timeout=180)
    if find('mini-player-play-pause').get('content-desc') == 'Abspielen':
        tap('mini-player-play-pause')
    tap('mini-player-open')
    find('soundcloud-swipe-hitbox')
    first_shape = wait_waveform(180000)
    adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'reset')
    screenshot('01-waveform-playing')
    surface = find('Waveform vor- oder zurückspulen')
    before_seek = position_ms()
    swipe(surface)
    time.sleep(1)
    find('Waveform vor- oder zurückspulen')
    assert position_ms() > before_seek + 5000, 'Playing seek did not change position'
    assert_waveform_visuals()
    screenshot('02-after-seek')
    # Previous must work while playing, even after more than three seconds.
    swipe(find('soundcloud-swipe-hitbox'))
    find('Smoke B')
    wait_waveform(90000)
    time.sleep(4)
    swipe(find('soundcloud-swipe-hitbox'), backwards=True)
    find('Smoke A')
    assert wait_waveform(180000)['points'] == first_shape['points'], 'Waveform changed after revisiting the track'
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    find('Waveform vor- oder zurückspulen')
    screenshot('03-waveform-paused')
    swipe(find('Waveform vor- oder zurückspulen'))
    time.sleep(1)
    paused_position = position_ms()
    swipe(find('Waveform vor- oder zurückspulen'), backwards=True)
    time.sleep(1)
    assert position_ms() < paused_position - 5000, 'Paused backward seek did not change position'
    tap('soundcloud-play-button')
    assert_native_track('A', 180)
    if position_ms() < 20000:
        swipe(find('Waveform vor- oder zurückspulen'))
        time.sleep(1)
    before_reorder, started = position_ms(), time.monotonic()
    tap('soundcloud-open-queue')
    # Upward 2 -> 1 is the KotlinAudio regression the old downward-only smoke missed.
    drag_row('queue-row-', 'smoke-c', 'smoke-b', 'queue-drag-handle-')
    assert_queue_order('acb')
    # Moving the playing row must leave its decoder and position intact.
    drag_row('queue-row-', 'smoke-a', 'smoke-b')
    assert_queue_order('cba')
    # Every row remains draggable when the playing item is last.
    drag_row('queue-row-', 'smoke-b', 'smoke-c', 'queue-drag-handle-')
    assert_queue_order('bca')
    drag_row('queue-row-', 'smoke-a', 'smoke-b')
    assert_queue_order('abc')
    drag_row('queue-row-', 'smoke-c', 'smoke-b', 'queue-drag-handle-')
    assert_queue_order('acb')
    screenshot('04-queue-reordered')
    tap('soundcloud-queue-close')
    assert_native_track('A', 180)
    after_reorder = position_ms()
    assert before_reorder - 1000 <= after_reorder <= before_reorder + (time.monotonic() - started) * 1000 + 2000, 'Reorder reset or jumped the playing audio'
    swipe(find('soundcloud-swipe-hitbox'))
    assert_native_track('C', 120)
    wait_waveform(120000)
    screenshot('05-third-format')
    # Native MediaSession confirms the new queue order actually drives playback.
    session = adb('shell', 'dumpsys', 'media_session').decode(errors='replace')
    (OUT / 'media-session.txt').write_text(session)
    assert 'Smoke C' in session, 'Native session did not switch to the reordered track'
    swipe(find('soundcloud-swipe-hitbox'))
    assert_native_track('B', 90)
    tap('now-playing-close')
    tap('library-tab-playlists')
    tap('open-playlist-smoke-list')
    drag_row('playlist-detail-song-', 'smoke-a', 'smoke-b', 'playlist-detail-drag-handle-')
    assert bounds(find('playlist-detail-song-smoke-b'))[1] < bounds(find('playlist-detail-song-smoke-a'))[1], 'Playlist grip did not reorder'
    drag_row('playlist-detail-song-', 'smoke-c', 'smoke-b')
    assert bounds(find('playlist-detail-song-smoke-c'))[1] < bounds(find('playlist-detail-song-smoke-b'))[1], 'Playlist long press did not reorder upwards'
    screenshot('06-playlist-reordered')
    tap('playlist-detail-song-smoke-c')
    find('soundcloud-swipe-hitbox')
    assert_native_track('C', 120)
    swipe(find('soundcloud-swipe-hitbox'))
    assert_native_track('B', 90)


def check_classic_cover_pages():
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    tap('now-playing-close')
    adb('shell', 'input', 'keyevent', '4')  # Playlist -> library.
    tap('library-open-menu')
    tap('library-menu-item-einstellungen')
    for _ in range(4):
        candidates = [node for node in ui().iter('node') if matches(node, 'settings-player-layout-classic')
                      and node.get('bounds') != '[0,0][0,0]']
        if candidates:
            tap_node(candidates[0])
            break
        x1, y1, x2, y2 = bounds(find('settings-scroll'))
        x = (x1 + x2) // 2
        adb('shell', 'input', 'swipe', str(x), str(int(y1 + (y2-y1)*.8)),
            str(x), str(int(y1 + (y2-y1)*.25)), '500')
    else:
        raise AssertionError('Classic player setting not reachable')
    adb('shell', 'input', 'keyevent', '4')
    tap('mini-player-open')
    find('Smoke B')
    viewport = bounds(find('now-playing-cover-pager'))
    initial = bounds(find('now-playing-cover-card'))
    assert viewport[2] - viewport[0] > initial[2] - initial[0] + 24, 'Cover still owns the shared viewport'
    x1, y1, x2, y2 = viewport
    x, y = int(x1 + (x2-x1)*.8), (y1+y2)//2
    end = int(x1 + (x2-x1)*.35)
    device.touch.down(x, y)
    try:
        for step in range(1, 9):
            device.touch.move(round(x + (end-x)*step/8), y)
            time.sleep(.05)
        current = bounds(find('now-playing-cover-card'))
        upcoming = bounds(find('now-playing-cover-next-card'))
        assert current[2] < initial[2] - 30, 'Current cover frame did not move with the image'
        assert upcoming[0] > current[2] + 12, 'Covers still slide inside a single shared window'
        screenshot('07-classic-cover-mid-swipe')
    finally:
        device.touch.up(end, y)
    find('Smoke A')
    swipe(find('now-playing-cover-pager'), backwards=True)
    find('Smoke B')
    screenshot('08-classic-cover-return')


try:
    prepare()
    check_playback()
    check_classic_cover_pages()
    logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
    assert not re.search(r'Expected .onGestureHandlerEvent.|FATAL EXCEPTION|ErrorBoundary caught', logs), 'Runtime error in app'
    assert '[PlaybackQueue] Reorder failed' not in logs, 'Native queue rejected a drag'
    (OUT / 'result.json').write_text(json.dumps({'status': 'passed', 'formats': ['mp3', 'm4a', 'flac'],
        'startupRetries': startup_retries,
        'pixelLauncherDialogs': launcher_dialogs,
        'checks': ['native-waveform-1024', 'visible-playhead', 'darker-played-waveform',
                   'stable-cache', 'playing-seek', 'paused-waveform',
                   'previous-while-playing', 'queue-grip-upwards', 'queue-long-press', 'active-track-move',
                   'last-active-track-reorder', 'native-duration-after-reorder', 'playlist-grip',
                   'playlist-long-press', 'playlist-playback-after-reorder',
                   'separate-cover-frames-mid-swipe', 'classic-cover-return']}, indent=2))
    print('Android player interaction smoke passed.', flush=True)
finally:
    collect_diagnostics(OUT, PACKAGE)
    try:
        for node in ui().iter('node'):
            if any(part in node.get('resource-id', '') for part in
                   ['queue-row-', 'drag-handle-', 'playlist-detail-song-', 'soundcloud-queue-close']):
                print('Final row:', {key: node.get(key) for key in
                      ['resource-id', 'content-desc', 'bounds', 'enabled']}, flush=True)
    except Exception as error:
        print('Final UI diagnostic unavailable: ' + str(error), flush=True)
