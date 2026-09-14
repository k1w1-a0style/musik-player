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


def position_ms():
    label = find('soundcloud-waveform-current-time').get('text', '')
    parts = [int(part) for part in label.split(':')]
    return sum(value * (60 ** index) for index, value in enumerate(reversed(parts))) * 1000


def screenshot(name):
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))


def assert_waveform_pixels(pixels, viewport):
    x1, y1, x2, y2 = viewport
    center = (x1 + x2) // 2
    def dominant(left, right):
        colored = Counter(pixels.getpixel((x, y)) for x in range(left, right)
                          for y in range(y1, y2)
                          if max(pixels.getpixel((x, y))) - min(pixels.getpixel((x, y))) > 40)
        assert colored, 'Waveform half has no colored pixels'
        return colored.most_common(1)[0][0]
    played, future = dominant(x1, center - 6), dominant(center + 6, x2)
    # Thin SVG strokes are antialiased onto different underlying layers. Check
    # visible brightness contrast, not exact equality to the source RGB color.
    def luminance(color):
        return sum(channel * weight for channel, weight in zip(color, (.2126, .7152, .0722)))
    ratio = luminance(played) / luminance(future)
    assert .25 <= ratio <= .8, f'Played waveform contrast is insufficient: {ratio:.3f}, {played}, {future}'
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
    for letter, seconds, ext, codec in [('A', 180, 'mp3', 'libmp3lame'), ('B', 90, 'm4a', 'aac'), ('C', 120, 'flac', 'flac')]:
        file = fixtures / (letter + '.' + ext)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                        f'aevalsrc=0.5*sin(2*PI*440*t)*(0.2+0.8*abs(sin(2*PI*t/9))):s=44100:d={seconds}',
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
    tap('soundcloud-open-queue')
    second = find('queue-row-smoke-b')
    third = find('queue-row-smoke-c')
    x1, y1, x2, y2 = bounds(find('queue-drag-handle-smoke-b'))
    _, z1, _, z2 = bounds(third)
    x = (x1 + x2) // 2
    print('Queue grip bounds:', [x1, y1, x2, y2], 'target:', bounds(third), flush=True)
    adb('shell', 'input', 'swipe', str(x), str((y1 + y2) // 2), str(x), str((z1 + z2) // 2), '650')
    time.sleep(.8)
    assert bounds(find('queue-row-smoke-c'))[1] < bounds(find('queue-row-smoke-b'))[1], 'Queue grip did not reorder'
    screenshot('04-queue-reordered')
    tap('soundcloud-queue-close')
    swipe(find('soundcloud-swipe-hitbox'))
    find('Smoke C')
    wait_waveform(120000)
    screenshot('05-third-format')
    # Native MediaSession confirms the new queue order actually drives playback.
    session = adb('shell', 'dumpsys', 'media_session').decode(errors='replace')
    (OUT / 'media-session.txt').write_text(session)
    assert 'Smoke C' in session, 'Native session did not switch to the reordered track'
    tap('now-playing-close')
    tap('library-tab-playlists')
    tap('open-playlist-smoke-list')
    first = find('playlist-detail-song-smoke-a')
    second = find('playlist-detail-song-smoke-b')
    x1, y1, x2, y2 = bounds(find('playlist-detail-drag-handle-smoke-a'))
    _, z1, _, z2 = bounds(second)
    x = (x1 + x2) // 2
    print('Playlist grip bounds:', [x1, y1, x2, y2], 'target:', bounds(second), flush=True)
    adb('shell', 'input', 'swipe', str(x), str((y1 + y2) // 2),
        str(x), str((z1 + z2) // 2), '650')
    time.sleep(.8)
    assert bounds(find('playlist-detail-song-smoke-b'))[1] < bounds(find('playlist-detail-song-smoke-a'))[1], 'Playlist grip did not reorder'
    screenshot('06-playlist-reordered')


try:
    prepare()
    check_playback()
    logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
    assert not re.search(r'Expected .onGestureHandlerEvent.|FATAL EXCEPTION|ErrorBoundary caught', logs), 'Runtime error in app'
    (OUT / 'result.json').write_text(json.dumps({'status': 'passed', 'formats': ['mp3', 'm4a', 'flac'],
        'startupRetries': startup_retries,
        'pixelLauncherDialogs': launcher_dialogs,
        'checks': ['native-waveform-1024', 'visible-playhead', 'darker-played-waveform',
                   'stable-cache', 'playing-seek', 'paused-waveform',
                   'previous-while-playing', 'queue-grip', 'native-next-after-reorder', 'playlist-grip']}, indent=2))
    print('Android player interaction smoke passed.', flush=True)
finally:
    screenshot('final')
    (OUT / 'logcat.txt').write_bytes(adb('logcat', '-d', '-v', 'threadtime', check=False))
    (OUT / 'gfxinfo.txt').write_bytes(adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, check=False))
    for node in ui().iter('node'):
        if any(part in node.get('resource-id', '') for part in
               ['queue-row-', 'drag-handle-', 'playlist-detail-song-', 'soundcloud-queue-close']):
            print('Final row:', {key: node.get(key) for key in
                  ['resource-id', 'content-desc', 'bounds', 'enabled']}, flush=True)
