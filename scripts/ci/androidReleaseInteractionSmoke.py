#!/usr/bin/env python3
"""Release-APK acceptance on an isolated emulator, using only public Android UI.

No Metro, run-as, private database writes, injected playlists or debug APK.
"""
import hashlib
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.k1w1a0style.musikplayer'
OUT = Path('ci-logs/release-interaction')
CHECKS = []
PLAYBACK_PROOFS = []
SCROLL_PROOFS = []
DEVICE = None
LAUNCHER_DIALOGS = 0
TITLES = ['V3 MP3 langer deutscher Titel zum Prüfen der Bedienbarkeit', 'V3 M4A', 'V3 FLAC', 'V3 Mix 21 Minuten']
FORMAT_DURATIONS = (90, 120, 150, 1260)
ACCENT_IDS = ('cover', 'green', 'cyan', 'turquoise', 'blue', 'violet', 'purple', 'pink', 'red', 'orange', 'yellow', 'neutral')
CLEANER_TITLE = 'V5  Cleaner'
CLEANER_ARTIST = 'V5  Proof'
CLEANER_TARGET = '/sdcard/Music/V5OnlySAF/V5-cleaner.mp3'
V5_PROOFS = {}
UI_SNAPSHOTS = {"compact": 0, "full": 0, "seconds": 0.0}
RETEST_ONLY_PATHS = frozenset({
    'scripts/ci/androidReleaseInteractionSmoke.py',
    'scripts/ci/androidReleaseInteractionSmoke_test.py',
    '.github/workflows/android-release-retest.yml',
    'docs/CODEX-V3-IMPLEMENTATION.md', 'docs/CODEX-V5-IMPLEMENTATION.md',
    'docs/CODEX-V5-CHECKPOINTS.md',
})


def adb(*args, check=True):
    return subprocess.run(['adb', *args], check=check, capture_output=True).stdout


def validate_target(apk, expected_sha, reviewed_commit, artifact_commit, emulator):
    assert emulator.strip() == '1', 'Release UI acceptance may run only on an isolated emulator'
    assert re.fullmatch(r'[0-9a-f]{40}', reviewed_commit), 'Missing immutable reviewed source'
    assert reviewed_commit == artifact_commit.strip(), 'APK artifact belongs to a different source commit'
    assert hashlib.sha256(Path(apk).read_bytes()).hexdigest() == expected_sha, 'APK bytes differ from inspected artifact'


def validate_retest_provenance(reviewed_commit, changed_paths, jobs):
    """Reuse an APK only when app sources are identical and its build gates passed."""
    assert re.fullmatch(r'[0-9a-f]{40}', reviewed_commit), 'Unpinned APK source'
    assert set(changed_paths) <= RETEST_ONLY_PATHS, 'App source differs from the existing inspected APK'
    required = ('Dependency security audit', 'Typecheck, tests, coverage, lint, config gates',
                'Android native build and tests')
    for name in required:
        selected = [job for job in jobs if job.get('name') == name]
        assert len(selected) == 1, 'Missing or ambiguous source gate: ' + name
        job = selected[0]
        assert job.get('head_sha') == reviewed_commit, 'Source gate belongs to another commit'
        assert job.get('status') == 'completed' and job.get('conclusion') == 'success', 'Source gate failed: ' + name


def import_confirmation_button(root):
    assert any(node.get('text') == 'Musik importieren' for node in root.iter('node')), 'Music import confirmation missing'
    button = next((node for node in root.iter('node') if matches(node, 'android:id/button1')
                   and node.get('text', '').lower() == 'importieren'), None)
    assert button is not None, 'Exact music import confirmation action missing'
    return button


def pixel_launcher_close_button(root):
    if not any(node.get('resource-id') == 'android:id/alertTitle'
               and node.get('text') == "Pixel Launcher isn't responding" for node in root.iter('node')):
        return None
    return next((node for node in root.iter('node')
                 if node.get('resource-id') == 'android:id/aerr_close' and node.get('text') == 'Close app'), None)


def rect(node):
    values = [int(value) for value in re.findall(r'-?\d+', node.get('bounds', ''))]
    assert len(values) == 4 and values[2] > values[0] and values[3] > values[1], 'UI element has no touch area'
    return values


def matches(node, key):
    return any(node.get(attr, '') == key or node.get(attr, '').endswith(':id/' + key)
               for attr in ('resource-id', 'text', 'content-desc'))


def tree(compressed=True):
    started = time.perf_counter()
    raw = DEVICE.dump_hierarchy(compressed=compressed, max_depth=80)
    UI_SNAPSHOTS['compact' if compressed else 'full'] += 1
    UI_SNAPSHOTS['seconds'] += time.perf_counter() - started
    (OUT / 'latest-ui.xml').write_text(raw)
    return ET.fromstring(raw)


def visible(node):
    try:
        x1, y1, x2, y2 = rect(node)
        return x1 >= 0 and y1 >= 0 and x2 <= 480 and y2 <= 960
    except AssertionError:
        return False


def candidate(key, root=None):
    return next((node for node in (root if root is not None else tree()).iter('node')
                 if matches(node, key) and visible(node)), None)


def find(key, timeout=25):
    global LAUNCHER_DIALOGS
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        frame = tree()
        launcher = pixel_launcher_close_button(frame)
        if launcher is not None:
            assert LAUNCHER_DIALOGS == 0, 'Pixel Launcher repeatedly stopped responding'
            screenshot('startup-pixel-launcher-dialog')
            LAUNCHER_DIALOGS += 1
            print('Closing the recorded Pixel Launcher system ANR dialog only.', flush=True)
            tap_node(launcher)
            time.sleep(.6)
            continue
        found = candidate(key, frame)
        if found is None:
            # Noninteractive test-ID containers may be pruned by Android's
            # compact hierarchy. Retain a full, exact fallback for those markers.
            found = candidate(key, tree(compressed=False))
        if found is not None:
            print('UI: ' + key, flush=True)
            return found
        time.sleep(.35)
    raise AssertionError('UI not reachable: ' + key)


def tap_node(node):
    x1, y1, x2, y2 = rect(node)
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))


def tap(key):
    tap_node(find(key))
    time.sleep(.35)


def back():
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(.5)


def vertical_scroll_surface(root, key):
    surfaces = [node for node in root.iter('node')
                if node.get('scrollable') == 'true'
                and 'HorizontalScrollView' not in node.get('class', '')
                and visible(node) and rect(node)[2]-rect(node)[0] >= 50
                and rect(node)[3]-rect(node)[1] >= 50]
    containing = [node for node in surfaces
                  if any(matches(child, key) for child in node.iter('node'))]
    selected = containing if containing else surfaces
    # The system tree picker nests a native GridView inside a ScrollView.
    # Its innermost surface owns the touch; unrelated sibling surfaces stay ambiguous.
    selected = [node for node in selected if not any(
        other is not node and other in node.iter('node') for other in selected)]
    assert len(selected) == 1, 'Vertical scroll surface absent or ambiguous: ' + key
    return selected[0]


def scroll_bounds(root, key):
    x1, y1, x2, y2 = rect(vertical_scroll_surface(root, key))
    mini = candidate('mini-player-viewport', root)
    if mini is None:
        mini = candidate('mini-player-open', root)
    if mini is not None:
        mx1, my1, mx2, _ = rect(mini)
        if mx1 < x2 and mx2 > x1 and y1 < my1 < y2:
            y2 = my1
    return x1, y1, x2, y2


def scroll_candidate(key, root):
    node = candidate(key, root)
    if node is None:
        return None
    parents = {child: parent for parent in root.iter() for child in parent}
    ancestor = parents.get(node)
    while ancestor is not None:
        if ancestor.get('scrollable') == 'true' and 'HorizontalScrollView' not in ancestor.get('class', ''):
            sx1, sy1, sx2, sy2 = scroll_bounds(root, key)
            x1, y1, x2, y2 = rect(node)
            # Android reports child bounds outside the parent clip and behind
            # the mini player. Such a label is not proof of a usable touch area.
            return node if sx1 <= x1 and sy1 <= y1 and x2 <= sx2 and y2 <= sy2 else None
        ancestor = parents.get(ancestor)
    return node


def vertical_swipe_coordinates(root, key, down=False):
    # Status cards, font scale and the mini player change the actual viewport.
    # Never start in a header/card or drag through unrelated controls.
    x1, y1, x2, y2 = scroll_bounds(root, key)
    inset = max(16, int((y2-y1)*.15))
    x, upper, lower = (x1+x2)//2, y1+inset, y2-inset
    assert lower-upper >= 16, 'Vertical scroll surface is too small: ' + key
    return (x, upper, x, lower) if down else (x, lower, x, upper)


def scroll_to(key, top=False, limit=24):
    for down in ([True]*10 if top else []) + [False]*limit:
        frame = tree()
        found = scroll_candidate(key, frame)
        if found is not None:
            return found
        clipped = candidate(key, frame)
        if clipped is not None:
            _, sy1, _, sy2 = scroll_bounds(frame, key)
            _, y1, _, y2 = rect(clipped)
            if y2 > sy2:
                down = False
            elif y1 < sy1:
                down = True
        coordinates = vertical_swipe_coordinates(frame, key, down=down)
        SCROLL_PROOFS.append({'target': key, 'direction': 'top' if down else 'bottom',
                             'surfaceBounds': rect(vertical_scroll_surface(frame, key)),
                             'coordinates': coordinates})
        adb('shell', 'input', 'swipe', *(str(value) for value in coordinates), '300')
        time.sleep(.2)
    found = scroll_candidate(key, tree())
    if found is not None:
        return found
    raise AssertionError('Scrollable UI not reachable: ' + key)


def select(key, top=False):
    tap_node(scroll_to(key, top=top))
    time.sleep(.4)


def screenshot(name):
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
    (OUT / (name + '.xml')).write_text(DEVICE.dump_hierarchy(compressed=False, max_depth=80))


def settings():
    tap('library-open-menu')
    tap('library-menu-item-einstellungen')
    find('settings-screen')


def checkbox(key, checked):
    node = scroll_to(key, top=True)
    if node.get('checked') != str(checked).lower():
        tap_node(node)
    time.sleep(.7)
    assert find(key).get('checked') == str(checked).lower(), 'Switch did not retain requested state: ' + key


def library_tab(name):
    key = 'library-tab-' + name
    for direction in (False, True):
        for _ in range(6):
            node = candidate(key)
            if node is not None:
                tap_node(node)
                time.sleep(.5)
                return
            area = rect(find('library-tabs'))
            y = (area[1]+area[3])//2
            start, end = (60, 420) if direction else (420, 60)
            adb('shell', 'input', 'swipe', str(start), str(y), str(end), str(y), '250')
    raise AssertionError('Library tab not reachable: ' + name)



def tree_grant_button(root, folder):
    expected = f'Allow k1w1-Musik to access files in {folder}?'
    if not any(node.get('text') == expected for node in root.iter('node')):
        return None
    return next((node for node in root.iter('node') if matches(node, 'android:id/button1')
                 and node.get('text', '').lower() == 'allow'
                 and node.get('enabled') == 'true' and visible(node)), None)


def wait_tree_grant(folder, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        button = tree_grant_button(tree(), folder)
        if button is not None:
            return button
        time.sleep(.3)
    raise AssertionError('Exact system folder grant confirmation missing: ' + folder)


def choose_folder(parts):
    # Exercise the real system tree picker. Only exact system navigation labels
    # and known generated fixture folders are touched.
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        root = tree()
        opener = next((node for node in root.iter('node') if node.get('content-desc') in ('Show roots', 'Navigate up')), None)
        if opener is not None:
            tap_node(opener)
            break
        time.sleep(.3)
    root = tree()
    storage = next((node for node in root.iter('node') if visible(node) and
                    (node.get('text') in ('Internal storage', 'Pixel 6') or node.get('text', '').startswith('sdk_gphone'))), None)
    assert storage is not None, 'Internal storage is absent from the system picker'
    tap_node(storage)
    for part in parts:
        tap_node(scroll_to(part))
        time.sleep(.4)
    root = tree()
    use = next((node for node in root.iter('node') if node.get('text', '').lower() == 'use this folder'), None)
    assert use is not None, 'System folder permission button missing'
    tap_node(use)
    # The actual failure captured only SystemUI during the transition, then
    # the exact ALLOW dialog in the final diagnostic frame. Never assume .4s.
    tap_node(wait_tree_grant(parts[-1]))
    time.sleep(.8)


def generated_audio():
    fixture = OUT / 'audio'
    fixture.mkdir(exist_ok=True)
    specifications = [('mp3', 'libmp3lame'), ('m4a', 'aac'), ('flac', 'flac'), ('mp3', 'libmp3lame')]
    adb('shell', 'mkdir', '-p', '/sdcard/Music/V3Proof', '/sdcard/Download/MusikBackup')
    for index, (extension, codec) in enumerate(specifications):
        duration = FORMAT_DURATIONS[index]
        path = fixture / f'V3-{index}.{extension}'
        command = ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=frequency={220+index*110}:sample_rate=22050',
                   '-t', str(duration), '-ac', '1', '-c:a', codec, '-metadata', 'title=' + TITLES[index],
                   '-metadata', 'artist=V3 Proof', '-metadata', 'album=V3 Acceptance', str(path)]
        subprocess.run(command, check=True)
        target = '/sdcard/Music/V3Proof/' + path.name
        adb('push', str(path), target)
        adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file://' + target)


def play_title(title):
    node = scroll_to(title + ' von V3 Proof', top=True)
    tap_node(node)
    # Existing mini-player UI can still represent the previous selection.
    # Require the exact app-owned title ACK; decoder playback is proved below.
    wait_selected_session(title)
    find('mini-player-open')


def assert_duration(seconds):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        root = tree()
        try:
            _, duration = timeline_values(root)
        except AssertionError:
            time.sleep(.4)
            continue
        # MP3's actual decoded duration can be a fraction below the fixture's
        # requested duration. Floor-to-mm:ss is allowed; other tracks still fail.
        if abs(duration-seconds) <= 1:
            return
        time.sleep(.4)
    raise AssertionError('Native decoded duration not visible: ' + str(seconds))


def classic_position(seconds):
    find('Audiospur-Fortschritt')
    position, duration = timeline_values(tree())
    assert abs(duration-seconds) <= 1, 'Decoded duration belongs to another track'
    return position


def time_seconds(label):
    assert re.fullmatch(r'(?:\d+:)?\d+:\d{2}', label), 'Native time has no valid M:SS/H:MM:SS value'
    parts = list(map(int, label.split(':')))
    assert parts[-1] < 60 and (len(parts) == 2 or parts[-2] < 60), 'Native time component exceeds 59'
    return sum(value * 60**index for index, value in enumerate(reversed(parts)))


def app_time_values(root):
    labels = [node.get('text', '') for node in root.iter('node') if node.get('package') == PACKAGE
              and re.fullmatch(r'(?:\d+:)?\d+:\d{2}', node.get('text', ''))]
    return [time_seconds(value) for value in labels]


def timeline_values(root):
    # Scope duration to the actual player timeline. A system clock, background
    # list label or elapsed time close to the fixture length is never proof.
    current = candidate('soundcloud-waveform-current-time', root)
    total = candidate('soundcloud-waveform-total-time', root)
    if current is not None and total is not None:
        assert current.get('package') == total.get('package') == PACKAGE, 'Timeline is not app-owned'
        return time_seconds(current.get('text', '')), time_seconds(total.get('text', ''))
    surface = candidate('Audiospur-Fortschritt', root)
    assert surface is not None and surface.get('package') == PACKAGE, 'Native player timeline is absent'
    parents = {child: parent for parent in root.iter() for child in parent}
    ancestor = parents.get(surface)
    while ancestor is not None:
        values = app_time_values(ancestor)
        if len(values) >= 2:
            assert len(values) == 2, 'Player timeline times are ambiguous'
            return values[0], values[1]
        ancestor = parents.get(ancestor)
    raise AssertionError('Decoded progress and duration are not visible in the timeline')


def import_public_collection():
    tap('library-open-menu')
    tap('library-menu-item-schnellscan-import')
    find('Musik importieren', timeout=60)
    screenshot('00-public-import-confirmation')
    tap_node(import_confirmation_button(tree()))
    find(TITLES[0] + ' von V3 Proof', timeout=150)
    screenshot('01-mediastore-import')
    CHECKS.append('MediaStore-import-public-UI')


def prepare_collection():
    import_public_collection()
    for index, duration in enumerate(FORMAT_DURATIONS[:3]):
        play_title(TITLES[index])
        tap('mini-player-open')
        assert_duration(duration)
        find('controls-play-pause')
        assert_native_playback(TITLES[index], duration)
        screenshot('format-' + str(index))
        tap('controls-play-pause')
        back()
    CHECKS.append('MP3-M4A-FLAC-native-duration-and-playback')
    path = OUT / 'audio' / 'V3-SAF.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=22050',
                    '-t', '80', '-c:a', 'libmp3lame', '-metadata', 'title=V3 SAF', '-metadata', 'artist=V3 Proof', str(path)], check=True)
    adb('shell', 'mkdir', '-p', '/sdcard/Music/V3OnlySAF')
    adb('push', str(path), '/sdcard/Music/V3OnlySAF/V3-SAF.mp3')
    tap('library-open-menu')
    tap('library-menu-item-ordner-hinzuf-gen')
    choose_folder(['Music', 'V3OnlySAF'])
    # Import does not imply visibility: the measured mini-player viewport can
    # legitimately place this fifth row offscreen. play_title scrolls to the
    # whole touchable card and requires the exact native selection ACK.
    play_title('V3 SAF')
    tap('mini-player-open')
    assert_duration(80)
    assert_native_playback('V3 SAF', 80)
    tap('controls-play-pause')
    screenshot('01-saf-import-and-playback')
    back()
    CHECKS.append('SAF-import-and-playback-public-UI')
    library_tab('playlists')
    tap('library-playlist-name-input')
    adb('shell', 'input', 'text', 'V3Backup')
    back()
    tap('library-playlist-create-button')
    tap('Playlist V3Backup')
    tap('playlist-detail-add-button')
    for title in TITLES[:2]:
        tap(title + ' zur Playlist hinzufügen')
    tap('playlist-detail-add-close')
    screenshot('02-playlist-before-backup')
    back()
    library_tab('tracks')
    play_title(TITLES[0])
    tap('mini-player-open')
    tap('Titel favorisieren')
    tap('controls-play-pause')
    back()


def resume_confirmation_button(root):
    assert any(node.get('package') == PACKAGE and node.get('text') == 'Wiedergabe fortsetzen?'
               for node in root.iter('node')), 'Exact app-owned resume dialog missing'
    buttons = [node for node in root.iter('node') if node.get('package') == PACKAGE
               and matches(node, 'android:id/button1') and node.get('text', '').casefold() == 'fortsetzen'
               and node.get('enabled') == 'true' and visible(node)]
    assert len(buttons) == 1, 'Exact enabled positive resume action missing or ambiguous'
    return buttons[0]


def validate_resumed_position(before, after, elapsed):
    # Native playback keeps advancing while the UI snapshots are collected.
    # Match the saved seek plus measured playback time, with the same 3-second
    # clock/whole-second allowance used by the native progress proof.
    assert elapsed >= 0 and abs(after-before-elapsed) <= 3, \
        f'Resume seek or native progress differs: {before} -> {after}, elapsed {elapsed:.3f}s'


def resume_acceptance():
    settings()
    checkbox('settings-resume-enabled', True)
    back()
    play_title(TITLES[3])
    tap('mini-player-open')
    assert_duration(1260)
    area = rect(find('Audiospur-Fortschritt'))
    x = int(area[0]+(area[2]-area[0])*.2)
    y = (area[1]+area[3])//2
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(3)
    tap('controls-play-pause')
    before = classic_position(1260)
    assert before > 30, 'The real paused seek did not reach a useful resume position'
    back()
    adb('shell', 'input', 'keyevent', '3')
    time.sleep(3)
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    find('mini-player-open', timeout=60)
    tap('mini-player-play-pause')
    find('Wiedergabe fortsetzen?')
    screenshot('03-resume-after-process-kill')
    tap_node(resume_confirmation_button(tree()))
    wait_playing_session(TITLES[3])
    resumed_at = time.monotonic()
    tap('mini-player-open')
    after = classic_position(1260)
    validate_resumed_position(before, after, time.monotonic()-resumed_at)
    validate_playing_session(app_media_session(), TITLES[3])
    screenshot('04-resume-applied')
    tap('controls-play-pause')
    back()
    settings()
    checkbox('settings-resume-enabled', False)
    select('settings-player-layout-soundcloud', top=True)
    back()
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    find('mini-player-open', timeout=60)
    play_title(TITLES[3])
    assert candidate('Wiedergabe fortsetzen?') is None, 'Disabled Resume still prompts'
    tap('mini-player-open')
    current = find('soundcloud-waveform-current-time').get('text', '')
    assert time_seconds(current) < 15, 'Disabled Resume applied an old saved position'
    screenshot('05-resume-off-starts-at-beginning')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    back()
    CHECKS.append('resume-On-kill-restart-choice-and-Off-regular-start')


def queue_probe_snapshot(name, expected_size):
    session = app_media_session()
    match = re.search(r'queueTitle=[^\n]*, size=(\d+)', session)
    assert match and int(match[1]) == expected_size, 'Probe did not establish its public queue: ' + name
    (OUT / (name + '-session.txt')).write_text(session)
    (OUT / (name + '-notifications.txt')).write_bytes(adb('shell', 'dumpsys', 'notification', '--noredact'))
    screenshot(name)
    print('Queue probe: ' + name + ': ' + session, flush=True)


def queue_replacement_probe():
    """Diagnostic only: reproduce a nonempty 2 -> 4 public queue replacement."""
    import_public_collection()
    library_tab('playlists')
    tap('library-playlist-name-input')
    adb('shell', 'input', 'text', 'QueueProbe')
    back()
    tap('library-playlist-create-button')
    tap('Playlist QueueProbe')
    tap('playlist-detail-add-button')
    for title in (TITLES[0], TITLES[2]):
        tap(title + ' zur Playlist hinzufügen')
    tap('playlist-detail-add-close')
    for attempt in range(2):
        if attempt:
            library_tab('playlists')
            select('Playlist QueueProbe')
        row = next((node for node in tree().iter('node') if
                    node.get('resource-id', '').split(':id/')[-1].startswith('playlist-detail-song-')
                    and node.get('content-desc', '').startswith(TITLES[0] + ' von V3 Proof abspielen.')), None)
        assert row is not None and visible(row), 'Probe playlist target absent'
        tap_node(row)
        wait_playing_session(TITLES[0])
        find('controls-play-pause')
        assert_native_playback(TITLES[0], 90)
        tap('controls-play-pause')
        queue_probe_snapshot(f'probe-{attempt}-paused-two', 2)
        back()
        back()
        library_tab('tracks')
        play_title(TITLES[1])
        queue_probe_snapshot(f'probe-{attempt}-selected-four', 4)
        tap('mini-player-open')
        assert_duration(120)
        assert_native_playback(TITLES[1], 120)
        queue_probe_snapshot(f'probe-{attempt}-playing-four', 4)
        tap('controls-play-pause')
        back()
    (OUT / 'diagnostic-result.json').write_text(json.dumps({
        'mode': 'queue-replacement-probe', 'status': 'diagnostic-only',
        'sourceCommit': os.environ['REVIEWED_APK_SOURCE_COMMIT'],
        'harnessCommit': os.environ['GITHUB_SHA'], 'playbackProofs': PLAYBACK_PROOFS,
        'releaseAccepted': False,
    }, indent=2))


def validate_playlist_contents(root, expected_ids, expected_titles):
    assert candidate('playlist-detail-screen', root) is not None, 'Playlist details are not visible'
    rows = [node for node in root.iter('node') if node.get('package') == PACKAGE
            and node.get('resource-id', '').split(':id/')[-1].startswith('playlist-detail-song-')]
    identifiers = [node.get('resource-id', '').split(':id/')[-1].removeprefix('playlist-detail-song-') for node in rows]
    assert identifiers == expected_ids, 'Restored playlist song identities or order differ from confirmed export'
    assert len(rows) == len(expected_titles), 'Playlist contains missing or unexpected songs'
    for index, (row, title) in enumerate(zip(rows, expected_titles)):
        expected = f'{title} von V3 Proof abspielen. Position {index+1} von {len(rows)}'
        assert row.get('content-desc') == expected, 'Restored playlist metadata or count differs'


def assert_restored_collection(expected_ids, suffix):
    library_tab('playlists')
    for name in ('V3Backup', 'V3Backup (Backup)'):
        select('Playlist ' + name)
        find('playlist-detail-screen')
        for song_id in expected_ids:
            find('playlist-detail-song-' + song_id)
        validate_playlist_contents(tree(), expected_ids, TITLES[:2])
        screenshot('backup-content-' + suffix + '-' + ('restored' if '(Backup)' in name else 'original'))
        back()
    library_tab('favorites')
    find(TITLES[0] + ' von V3 Proof')
    screenshot('backup-favorite-' + suffix)
    library_tab('tracks')


def backup_acceptance():
    settings()
    select('backup-create', top=True)
    choose_folder(['Download', 'MusikBackup'])
    find('Backup gespeichert', timeout=45)
    tap('android:id/button1')
    files = adb('shell', 'ls', '/sdcard/Download/MusikBackup').decode().splitlines()
    assert len(files) == 1, 'Expected exactly one newly generated backup'
    adb('pull', '/sdcard/Download/MusikBackup/' + files[0], str(OUT / 'exported-backup.json'))
    backup = json.loads((OUT / 'exported-backup.json').read_text())
    assert backup['format'] == 'k1w1-musik-backup' and backup['version'] == 1
    assert len(backup['playlists']) == 1 and len(backup['playlists'][0]['songIds']) == 2
    assert len(backup['favorites']) == 1, 'Favorite missing from confirmed export'
    select('backup-inspect', top=True)
    choose_folder(['Download', 'MusikBackup'])
    tap(files[0])
    find('backup-preview')
    screenshot('06-backup-read-only-preview')
    scroll_to('Schließen')
    assert candidate('backup-restore-apply') is None, 'Read-only inspection can apply live data'
    tap('Schließen')
    select('backup-select-restore', top=True)
    choose_folder(['Download', 'MusikBackup'])
    tap(files[0])
    find('backup-preview')
    assert find('backup-apply-settings').get('checked') == 'false', 'Settings replacement is not opt-in'
    screenshot('07-backup-restore-preview')
    select('backup-restore-apply')
    find('Backup & Wiederherstellung', timeout=45)
    tap('android:id/button1')
    find('library-open-menu', timeout=60)
    library_tab('playlists')
    find('Playlist V3Backup')
    find('Playlist V3Backup (Backup)')
    screenshot('08-backup-added-with-original-preserved')
    expected_ids = backup['playlists'][0]['songIds']
    assert_restored_collection(expected_ids, 'applied')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    find('library-open-menu', timeout=60)
    assert_restored_collection(expected_ids, 'cold-start')
    CHECKS.append('restore-original-and-copy-playlist-content-order-ids-and-favorite-survive-cold-start')
    CHECKS.append('SAF-backup-export-readback-read-only-inspection-preview-restore-preserves-original')


def soundcloud_seconds():
    value = find('soundcloud-waveform-current-time').get('text', '')
    return time_seconds(value)


def app_media_session():
    dump = adb('shell', 'dumpsys', 'media_session').decode(errors='replace')
    lines = dump.splitlines()
    matching = []
    for index, line in enumerate(lines):
        match = re.fullmatch(r'([ \t]*)package=([^ \t]+)', line)
        if not match or match[2] != PACKAGE:
            continue
        indent = len(match[1])
        block = [line]
        for next_line in lines[index+1:]:
            stripped = next_line.lstrip(' \t')
            if stripped and (len(next_line)-len(stripped) < indent
                             or stripped.startswith('package=')
                             or re.match(r'Session #\d+:', stripped)):
                break
            block.append(next_line)
        matching.append('\n'.join(block))
    assert len(matching) == 1, 'Native media session missing or ambiguous'
    (OUT / 'media-session.txt').write_text(matching[0])
    return matching[0]



def validate_selected_session(session, title):
    assert re.search(r'^[ \t]*package=' + re.escape(PACKAGE) + r'[ \t]*$', session, re.M), 'Native session belongs to another app'
    assert re.search(r'^[ \t]*metadata:[^\n]*description=' + re.escape(title) + r'(?:,|[ \t]*$)', session, re.M), 'Native session selected another track: ' + title


def wait_selected_session(title, timeout=15):
    deadline = time.monotonic() + timeout
    last_error = 'Native selection not checked'
    while time.monotonic() < deadline:
        try:
            session = app_media_session()
            validate_selected_session(session, title)
            return session
        except AssertionError as error:
            last_error = str(error)
        time.sleep(.4)
    raise AssertionError(last_error)


def validate_playing_session(session, title):
    assert re.search(r'^[ \t]*package=' + re.escape(PACKAGE) + r'[ \t]*$', session, re.M), 'Native session belongs to another app'
    state = re.search(r'PlaybackState\s*\{state=(?:([A-Z_]+)\((\d+)\)|(\d+))(?=[,\s}])', session)
    assert state and ((state[1], state[2]) == ('PLAYING', '3') or state[3] == '3'), 'Native playback is not playing'
    validate_selected_session(session, title)


def wait_playing_session(title, timeout=15):
    deadline = time.monotonic() + timeout
    last_error = 'Native session not checked'
    while time.monotonic() < deadline:
        try:
            session = app_media_session()
            validate_playing_session(session, title)
            return session
        except AssertionError as error:
            last_error = str(error)
        time.sleep(.4)
    raise AssertionError(last_error)


def assert_native_playback(title, duration, position_reader=None):
    # Read both public UI progress and Android's actual session. Metadata and a
    # visible play/pause button alone can pass even when a decoder never starts.
    read_position = position_reader or (lambda: classic_position(duration))
    wait_playing_session(title)
    before, started = read_position(), time.monotonic()
    time.sleep(4)
    after = read_position()
    elapsed = time.monotonic()-started
    assert before+2 <= after <= before+elapsed+3, 'Native position did not advance plausibly: ' + title
    validate_playing_session(app_media_session(), title)
    PLAYBACK_PROOFS.append({'title': title, 'expectedDurationSeconds': duration,
                           'beforeSeconds': before, 'afterSeconds': after,
                           'elapsedSeconds': round(elapsed, 3), 'nativeState': 3})
    print(f'Native playback: {title}: {before}s -> {after}s, state=3', flush=True)


def horizontal_swipe_coordinates(node):
    x1, y1, x2, y2 = rect(node)
    assert visible(node) and x2-x1 >= 120, 'Cover swipe area is absent or too narrow'
    # Swipe right across the cover, away from waveform/transport controls.
    y = (y1+y2)//2
    return int(x1+(x2-x1)*.15), y, int(x1+(x2-x1)*.85), y


def queue_node(root, title):
    label = title + ' von V3 Proof abspielen'
    nodes = [node for node in root.iter('node') if
             node.get('resource-id', '').split(':id/')[-1].startswith('queue-row-')
             and node.get('content-desc', '').startswith(label) and visible(node)]
    assert len(nodes) == 1, 'Queue title is absent or ambiguous: ' + title
    return nodes[0]


def background_and_queue_acceptance():
    # Resume is already OFF. A real playing native position must advance while
    # the app is offscreen; a metadata-only duration cannot satisfy this check.
    play_title(TITLES[3])
    tap('mini-player-open')
    started = soundcloud_seconds()
    time.sleep(4)
    before = soundcloud_seconds()
    assert before >= started+2, 'Native position did not advance during playback'
    adb('shell', 'input', 'keyevent', '3')
    time.sleep(6)
    session = app_media_session()
    validate_playing_session(session, TITLES[3])
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    find('soundcloud-waveform-current-time', timeout=30)
    assert soundcloud_seconds() >= before+3, 'Background playback position did not advance'
    screenshot('09-background-playback-return')
    CHECKS.append('native-playing-session-and-position-advance-in-background')
    before_reorder, start = soundcloud_seconds(), time.monotonic()
    tap('soundcloud-open-queue')
    frame = tree()
    source, target = queue_node(frame, TITLES[0]), queue_node(frame, TITLES[1])
    source_key = source.get('resource-id').split(':id/')[-1]
    target_key = target.get('resource-id').split(':id/')[-1]
    handle = find(source_key.replace('queue-row-', 'queue-drag-handle-', 1))
    x1, y1, x2, y2 = rect(handle)
    _, t1, _, t2 = rect(target)
    adb('shell', 'input', 'swipe', str((x1+x2)//2), str((y1+y2)//2),
        str((x1+x2)//2), str((t1+t2)//2), '650')
    deadline = time.monotonic()+12
    while time.monotonic() < deadline:
        frame = tree()
        left, right = queue_node(frame, TITLES[0]), queue_node(frame, TITLES[1])
        if rect(left)[1] < rect(right)[1] and rect(left)[3] <= rect(right)[1]+1:
            break
        time.sleep(.4)
    else:
        raise AssertionError('Real queue drag did not publish the requested order')
    screenshot('10-real-queue-reordered')
    tap('soundcloud-queue-close')
    after = soundcloud_seconds()
    assert before_reorder-1 <= after <= before_reorder+time.monotonic()-start+3, 'Queue reorder reset or jumped the playing track'
    tap('soundcloud-open-queue')
    tap(target_key)
    if candidate('soundcloud-queue-close') is not None:
        tap('soundcloud-queue-close')
    assert_duration(FORMAT_DURATIONS[1])
    assert_native_playback(TITLES[1], FORMAT_DURATIONS[1], soundcloud_seconds)
    screenshot('11-native-queue-track-selection')
    tap('soundcloud-open-queue')
    frame = tree()
    left, right = queue_node(frame, TITLES[0]), queue_node(frame, TITLES[1])
    rows = sorted((node for node in frame.iter('node') if visible(node)
                   and node.get('resource-id', '').split(':id/')[-1].startswith('queue-row-')),
                  key=lambda node: rect(node)[1])
    target_index = rows.index(right)
    assert target_index > 0 and rows[target_index-1] is left, 'Swipe predecessor is not the confirmed reordered MP3'
    tap('soundcloud-queue-close')
    start_x, start_y, end_x, end_y = horizontal_swipe_coordinates(find('soundcloud-swipe-hitbox'))
    adb('shell', 'input', 'swipe', str(start_x), str(start_y), str(end_x), str(end_y), '320')
    wait_playing_session(TITLES[0])
    assert_duration(FORMAT_DURATIONS[0])
    assert_native_playback(TITLES[0], FORMAT_DURATIONS[0], soundcloud_seconds)
    screenshot('12-real-horizontal-cover-swipe')
    CHECKS.append('real-horizontal-cover-swipe-selects-previous-native-track-and-advances')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    back()
    CHECKS.append('real-queue-drag-preserves-playing-position-and-selects-native-track')


def synchsafe(value):
    assert 0 <= value < (1 << 28), 'ID3 length is outside its encoding'
    return bytes((value >> shift) & 127 for shift in (21, 14, 7, 0))


def id3_frames(data):
    """Independent fixture verifier; rejects truncated/unsupported ID3 layouts."""
    assert data[:3] == b'ID3' and data[3] in (3, 4) and data[5] == 0
    assert all(value < 128 for value in data[6:10]), 'Invalid ID3 tag length'
    end = 10 + sum(value << shift for value, shift in zip(data[6:10], (21, 14, 7, 0)))
    assert end <= len(data), 'Truncated ID3 tag'
    frames, start = {}, 10
    while start < end and data[start] != 0:
        header = data[start:start+10]
        assert len(header) == 10 and re.fullmatch(rb'[A-Z0-9]{4}', header[:4]) and header[8:] == b'\x00\x00'
        size = int.from_bytes(header[4:8], 'big') if data[3] == 3 else sum(value << shift for value, shift in zip(header[4:8], (21, 14, 7, 0)))
        assert start + 10 + size <= end, 'Truncated ID3 frame'
        frames.setdefault(header[:4].decode(), []).append(data[start+10:start+10+size])
        start += 10 + size
    assert not any(data[start:end]), 'Nonzero data after ID3 padding'
    return frames, data[end:]


def dirty_cleaner_fixture():
    path = OUT / 'audio' / 'V5-cleaner.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=550:sample_rate=22050',
                    '-t', '75', '-c:a', 'libmp3lame', '-id3v2_version', '0', '-write_id3v1', '0', str(path)], check=True)
    image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=')
    values = [('TIT2', b'\x00' + CLEANER_TITLE.encode()), ('TPE1', b'\x00' + CLEANER_ARTIST.encode()),
              ('TALB', b'\x00V5 Acceptance'), ('TRCK', b'\x0001/01'), ('TPUB', b'\x00Beatfreakz Records'),
              ('WXXX', b'\x00\x00https://pro.beatport.com'), ('APIC', b'\x00image/png\x00\x03\x00' + image),
              ('XKIW', b'Unknown frame must survive V5')]
    body = b''.join(key.encode() + len(value).to_bytes(4, 'big') + b'\x00\x00' + value for key, value in values)
    path.write_bytes(b'ID3\x03\x00\x00' + synchsafe(len(body)) + body + path.read_bytes())
    return path


def validate_cleaner_write(before, after):
    original, original_audio = id3_frames(before)
    updated, updated_audio = id3_frames(after)
    assert before != after, 'Physical cleaner apply did not change the synthetic original'
    assert original_audio == updated_audio, 'Encoded audio bytes changed'
    for field in ('APIC', 'TPUB', 'WXXX', 'XKIW'):
        assert original[field] == updated.get(field), 'Preserved frame changed: ' + field
    for field, expected in (('TIT2', 'V5 Cleaner'), ('TPE1', 'V5 Proof')):
        payloads = updated.get(field, [])
        assert len(payloads) == 1, 'Changed text frame missing or duplicated'
        encoding = {0: 'latin1', 1: 'utf-16', 2: 'utf-16-be', 3: 'utf-8'}.get(payloads[0][0])
        assert encoding is not None and payloads[0][1:].decode(encoding).rstrip('\x00') == expected, 'Unexpected cleaned text: ' + field
    return {'beforeSha256': hashlib.sha256(before).hexdigest(), 'afterSha256': hashlib.sha256(after).hexdigest(),
            'audioSha256': hashlib.sha256(original_audio).hexdigest(), 'preservedFrames': ['APIC', 'TPUB', 'WXXX', 'XKIW']}


def public_cold_start():
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    find('library-open-menu', timeout=60)


def assert_radio_selected(root, key):
    node = candidate(key, root)
    assert node is not None and node.get('checked') == 'true', 'Radio choice not selected: ' + key


def accent_acceptance():
    settings()
    for field in ('waveform-accent', 'appAccent', 'playerAccent'):
        for index, color in enumerate(ACCENT_IDS):
            key = f'settings-{field}-{color}'
            select(key, top=index == 0)
            assert_radio_selected(tree(), key)
    # Distinct persisted values prove that the three preferences do not alias.
    for field, color in (('appAccent', 'purple'), ('playerAccent', 'cyan'), ('waveform-accent', 'blue')):
        key = f'settings-{field}-{color}'
        select(key, top=True)
        assert_radio_selected(tree(), key)
    checkbox('settings-instant-colors', True)
    screenshot('v5-three-independent-accent-preferences')
    back()
    public_cold_start()
    settings()
    for field, color in (('appAccent', 'purple'), ('playerAccent', 'cyan'), ('waveform-accent', 'blue')):
        key = f'settings-{field}-{color}'
        scroll_to(key, top=True)
        assert_radio_selected(tree(), key)
    assert scroll_to('settings-instant-colors', top=True).get('checked') == 'true', 'Instant colors lost on cold start'
    for layout, control in (('classic', 'controls-play-pause'), ('soundcloud', 'soundcloud-play-button')):
        select('settings-player-layout-' + layout, top=True)
        back()
        tap('mini-player-open')
        find(control)
        screenshot('v5-independent-accents-' + layout)
        back()
        settings()
    back()
    V5_PROOFS['accents'] = {'choicesPerPreference': 12, 'persisted': {'appAccent': 'purple', 'playerAccent': 'cyan', 'waveformAccent': 'blue', 'instantColors': True}, 'layouts': ['classic', 'soundcloud']}
    CHECKS.append('V5-36-public-radio-choices-independent-preferences-cold-start-both-player-layouts')


def open_cleaner_from_song(title, artist):
    node = scroll_to(title + ' von ' + artist, top=True)
    x1, y1, x2, y2 = rect(node)
    adb('shell', 'input', 'swipe', str((x1+x2)//2), str((y1+y2)//2), str((x1+x2)//2), str((y1+y2)//2), '900')
    find('library-selection-actions')
    tap('Tags bereinigen')
    find('tag-cleaner-analyze')


def validate_cleaner_result(root, mode):
    expected_status = 'Anzeige gespeichert' if mode == 'display' else 'Datei geändert'
    result_text = [node.get('text', '') for node in root.iter('node')]
    assert any(text.endswith(': ' + expected_status) for text in result_text), 'Cleaner did not confirm durable success'
    assert any(re.fullmatch(r'1 geprüft · \d+ unverändert · 1 geändert · 0 übersprungen · \d+ Konflikte · 0 fehlgeschlagen · 0 offen / unterbrochen', text)
               for text in result_text), 'Cleaner result contains unresolved or failed operations'


def cleaner_apply_dialog(mode):
    select('tag-cleaner-apply', top=True)
    root = tree()
    expected = 'Bibliotheksanzeige speichern' if mode == 'display' else 'Originaldatei-Tags schreiben'
    assert any(node.get('text') == expected for node in root.iter('node')), 'Wrong cleaner apply confirmation'
    button = candidate('android:id/button1', root)
    assert button is not None and button.get('text', '').lower() == 'ausgewählte änderungen anwenden', 'Exact cleaner apply action absent'
    tap_node(button)
    find('tag-cleaner-result', timeout=90)
    # A rendered result is insufficient: the acknowledged per-file outcome must pass.
    validate_cleaner_result(tree(), mode)


def select_cleaner_safe_playback_queue():
    # Public playlist playback replaces the queue with two known other sources.
    # Pausing alone would leave an automatic-next candidate unsafe to write.
    backup = json.loads((OUT / 'exported-backup.json').read_text())
    expected_ids = backup['playlists'][0]['songIds']
    library_tab('playlists')
    select('Playlist V3Backup')
    tap('playlist-detail-song-' + expected_ids[0])
    wait_playing_session(TITLES[0])
    tap('soundcloud-open-queue')
    rows = [node for node in tree().iter('node')
            if node.get('resource-id', '').split(':id/')[-1].startswith('queue-row-')]
    actual_ids = [node.get('resource-id', '').split(':id/')[-1].removeprefix('queue-row-') for node in rows]
    assert actual_ids == expected_ids, 'Public playlist playback did not exclude the cleaner fixture from its queue'
    tap('soundcloud-queue-close')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    back()
    back()
    library_tab('tracks')


def cleaner_acceptance():
    path = dirty_cleaner_fixture()
    original = path.read_bytes()
    adb('shell', 'mkdir', '-p', '/sdcard/Music/V5OnlySAF')
    adb('push', str(path), CLEANER_TARGET)
    tap('library-open-menu')
    tap('library-menu-item-ordner-hinzuf-gen')
    choose_folder(['Music', 'V5OnlySAF'])
    # The following public long-press selection scrolls to the imported row;
    # import success does not require a fifth/sixth row to start onscreen.
    select_cleaner_safe_playback_queue()
    open_cleaner_from_song('V5 Cleaner', 'V5 Proof')
    select('tag-cleaner-analyze')
    find('tag-cleaner-select-safe', timeout=90)
    screenshot('v5-cleaner-read-only-display-preview')
    pulled = OUT / 'audio' / 'V5-after-preview.mp3'
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'Analysis modified the original file'
    select('tag-cleaner-select-safe', top=True)
    cleaner_apply_dialog('display')
    screenshot('v5-cleaner-confirmed-display-result')
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'Display-only apply modified the original file'
    public_cold_start()
    library_tab('tracks')
    find('V5 Cleaner von V5 Proof', timeout=60)
    open_cleaner_from_song('V5 Cleaner', 'V5 Proof')
    select('tag-cleaner-analyze')
    find('tag-cleaner-select-safe', timeout=90)
    assert any('bereits sauber' in node.get('text', '') for node in tree().iter('node')), 'Display cleanup lost its acknowledged correction on cold start'
    assert find('tag-cleaner-apply').get('enabled') == 'false', 'Already clean display fields can be applied again'
    select('Regeln ändern', top=True)
    select('tag-cleaner-mode-file', top=True)
    select('tag-cleaner-analyze', top=True)
    find('tag-cleaner-select-safe', timeout=90)
    root = tree()
    assert any(node.get('text') == 'Vorher: ' + CLEANER_TITLE for node in root.iter('node')), 'File preview omitted original raw whitespace'
    screenshot('v5-cleaner-raw-file-preview')
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'File-tag analysis modified the original'
    select('tag-cleaner-select-safe', top=True)
    cleaner_apply_dialog('file')
    screenshot('v5-cleaner-confirmed-saf-file-result')
    adb('pull', CLEANER_TARGET, str(pulled))
    V5_PROOFS['cleaner'] = validate_cleaner_write(original, pulled.read_bytes())
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(pulled)], check=True, capture_output=True)
    (OUT / 'v5-cleaner-independent-ffprobe.json').write_bytes(probe.stdout)
    public_cold_start()
    library_tab('tracks')
    find('V5 Cleaner von V5 Proof', timeout=60)
    V5_PROOFS['cleaner'].update({'readOnlyPreviewExactBytes': True, 'displayApplyExactOriginalBytes': True, 'coldStartPersisted': True, 'fixture': 'generated synthetic SAF MP3, no user music'})
    settings()
    select('settings-tag-cleaner', top=True)
    find('Welche Musik möchtest du aufräumen?')
    back()
    back()
    CHECKS.append('V5-settings-longpress-selection-raw-preview-display-ack-cold-start-real-SAF-write-audio-APIC-unknown-frames-preserved')


def ui_matrix():
    for scale in ('1.0', '1.3', '2.0'):
        adb('shell', 'settings', 'put', 'system', 'font_scale', scale)
        for appearance in ('dark', 'light'):
            for skin in ('graphite', 'minimal', 'neon-cover'):
                settings()
                select('settings-appearance-' + appearance, top=True)
                select('settings-skin-' + skin, top=True)
                checkbox('settings-quiet-profile', True)
                select('settings-waveform-accent-blue', top=True)
                for density in ('standard', 'compact'):
                    select('settings-density-' + density, top=True)
                    screenshot(f'settings-{scale}-{appearance}-{skin}-{density}')
                    back()
                    first = scroll_to(TITLES[0] + ' von V3 Proof', top=True)
                    assert visible(first), 'Long German title cannot be selected'
                    identifier = first.get('resource-id', '').split(':id/')[-1]
                    assert identifier.startswith('song-card-'), 'Song action has no stable public UI identity'
                    menu = find(identifier.replace('song-card-', 'song-card-info-', 1))
                    play_box, menu_box = rect(first), rect(menu)
                    assert menu_box[2]-menu_box[0] >= 72 and menu_box[3]-menu_box[1] >= 72, 'Song menu is smaller than 48dp'
                    assert play_box[2] <= menu_box[0]+1, 'Song play area overlaps its menu'
                    screenshot(f'library-{scale}-{appearance}-{skin}-{density}')
                    tap_node(menu)
                    find('song-action-menu-card')
                    back()
                    tap('mini-player-open')
                    find('soundcloud-play-button')
                    screenshot(f'player-{scale}-{appearance}-{skin}-{density}')
                    back()
                    if density == 'standard':
                        settings()
    CHECKS.append('320dp-font-1.0-1.3-2.0-all-six-themes-standard-compact-48dp-menu-quiet-blue')
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')


def main():
    global DEVICE
    apk = Path('preview-input/musik-player-preview.apk')
    sha = (Path('preview-input') / 'apk-sha256.txt').read_text().split()[0]
    commit = os.environ.get('REVIEWED_APK_SOURCE_COMMIT', os.environ['GITHUB_SHA'])
    if 'EXPECTED_APK_SHA256' in os.environ:
        assert sha == os.environ['EXPECTED_APK_SHA256'], 'Inspected artifact digest is not the pinned digest'
    validate_target(apk, sha, commit, Path('preview-input/source-commit.txt').read_text(), adb('shell', 'getprop', 'ro.kernel.qemu').decode())
    import uiautomator2
    OUT.mkdir(parents=True, exist_ok=True)
    DEVICE = uiautomator2.connect()
    generated_audio()
    adb('install', '-r', str(apk))
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.READ_MEDIA_AUDIO')
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    try:
        find('library-open-menu', timeout=90)
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'queue-replacement-probe':
            print('Diagnostic only: public two-to-four queue replacement; no release acceptance.', flush=True)
            queue_replacement_probe()
            return
        print('Stage: public scan, formats and collection', flush=True)
        prepare_collection()
        print('Stage: resume and real process restart', flush=True)
        resume_acceptance()
        print('Stage: native background playback and real queue gestures', flush=True)
        background_and_queue_acceptance()
        print('Stage: SAF backup export, inspection and restore', flush=True)
        backup_acceptance()
        print('Stage: V5 independent accents and persistence', flush=True)
        accent_acceptance()
        print('Stage: V5 cleaner synthetic SAF transaction', flush=True)
        cleaner_acceptance()
        print('Stage: font, theme and density matrix', flush=True)
        ui_matrix()
        logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
        assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'App runtime failure'
        result = {'status': 'passed', 'commit': commit, 'harnessCommit': os.environ['GITHUB_SHA'], 'apkSha256': sha, 'checks': CHECKS,
                  'playbackProofs': PLAYBACK_PROOFS, 'scrollProofs': SCROLL_PROOFS,
                  'pixelLauncherDialogs': LAUNCHER_DIALOGS, 'v5Proofs': V5_PROOFS, 'uiSnapshots': UI_SNAPSHOTS,
                  'device': 'isolated API 35 x86_64 emulator, 480x960 pixels / density 240 = 320dp',
                  'limits': ['No A50 baseline performance comparison', 'No actual spoken TalkBack verification',
                             'Provider faults and restore journal interruptions covered separately by host/native tests']}
        (OUT / 'result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result), flush=True)
    finally:
        from androidSmokeDiagnostics import collect_diagnostics
        collect_diagnostics(OUT, PACKAGE)
        screenshot('final')
        (OUT / 'meminfo.txt').write_bytes(adb('shell', 'dumpsys', 'meminfo', PACKAGE, check=False))
        (OUT / 'gfxinfo.txt').write_bytes(adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'framestats', check=False))


if __name__ == '__main__':
    main()
