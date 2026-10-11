#!/usr/bin/env python3
"""Release-APK acceptance on an isolated emulator, using only public Android UI.

No Metro, run-as, private database writes, injected playlists or debug APK.
"""
import hashlib
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
DEVICE = None
TITLES = ['V3 MP3 langer deutscher Titel zum Prüfen der Bedienbarkeit', 'V3 M4A', 'V3 FLAC', 'V3 Mix 21 Minuten']
FORMAT_DURATIONS = (90, 120, 150, 1260)
RETEST_ONLY_PATHS = frozenset({
    'scripts/ci/androidReleaseInteractionSmoke.py',
    'scripts/ci/androidReleaseInteractionSmoke_test.py',
    '.github/workflows/android-release-retest.yml',
    'docs/CODEX-V3-IMPLEMENTATION.md',
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


def rect(node):
    values = [int(value) for value in re.findall(r'\d+', node.get('bounds', ''))]
    assert len(values) == 4 and values[2] > values[0] and values[3] > values[1], 'UI element has no touch area'
    return values


def matches(node, key):
    return any(node.get(attr, '') == key or node.get(attr, '').endswith(':id/' + key)
               for attr in ('resource-id', 'text', 'content-desc'))


def tree():
    raw = DEVICE.dump_hierarchy(compressed=False, max_depth=80)
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
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        found = candidate(key)
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


def scroll_to(key, top=False, limit=24):
    if top:
        for _ in range(10):
            adb('shell', 'input', 'swipe', '240', '250', '240', '780', '180')
    for _ in range(limit):
        found = candidate(key)
        if found is not None:
            return found
        adb('shell', 'input', 'swipe', '240', '760', '240', '270', '300')
        time.sleep(.2)
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
    time.sleep(.4)
    root = tree()
    allow = next((node for node in root.iter('node') if node.get('text', '').lower() == 'allow'), None)
    assert allow is not None, 'System folder grant confirmation missing'
    tap_node(allow)
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
    find('mini-player-open')


def assert_duration(seconds):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        root = tree()
        values = [node.get('text', '') for node in root.iter('node') if re.fullmatch(r'\d+:\d{2}', node.get('text', ''))]
        expected = f'{seconds//60}:{seconds%60:02}'
        if expected in values:
            return
        time.sleep(.4)
    raise AssertionError('Native decoded duration not visible: ' + str(seconds))


def classic_position(seconds):
    root = find('waveform-scrubber')
    labels = [node.get('text', '') for node in root.iter('node') if re.fullmatch(r'\d+:\d{2}', node.get('text', ''))]
    values = [int(value.split(':')[0])*60+int(value.split(':')[1]) for value in labels]
    assert seconds in values and len(values) >= 2, 'Decoded progress and duration are not visible in the waveform'
    return next(value for value in values if value != seconds)


def prepare_collection():
    tap('library-open-menu')
    tap('library-menu-item-schnellscan-import')
    find('Musik importieren', timeout=60)
    screenshot('00-public-import-confirmation')
    tap_node(import_confirmation_button(tree()))
    find(TITLES[0] + ' von V3 Proof', timeout=150)
    screenshot('01-mediastore-import')
    CHECKS.append('MediaStore-import-public-UI')
    for index, duration in enumerate(FORMAT_DURATIONS[:3]):
        play_title(TITLES[index])
        tap('mini-player-open')
        assert_duration(duration)
        find('controls-play-pause')
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
    find('V3 SAF von V3 Proof', timeout=150)
    play_title('V3 SAF')
    tap('mini-player-open')
    assert_duration(80)
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
    tap('Fortsetzen')
    tap('mini-player-open')
    after = classic_position(1260)
    assert abs(after-before) < 12, f'Resume did not confirm the saved native position: {before} -> {after}'
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
    minutes, seconds = map(int, current.split(':'))
    assert minutes*60+seconds < 15, 'Disabled Resume applied an old saved position'
    screenshot('05-resume-off-starts-at-beginning')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    back()
    CHECKS.append('resume-On-kill-restart-choice-and-Off-regular-start')


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
    library_tab('tracks')
    CHECKS.append('SAF-backup-export-readback-read-only-inspection-preview-restore-preserves-original')


def soundcloud_seconds():
    value = find('soundcloud-waveform-current-time').get('text', '')
    assert re.fullmatch(r'\d+:\d{2}', value), 'Native progress has no valid time'
    minutes, seconds = map(int, value.split(':'))
    return minutes*60+seconds


def app_media_session():
    session = adb('shell', 'dumpsys', 'media_session').decode(errors='replace')
    blocks = re.split(r'(?=\bSession #\d+:)', session)
    matching = [block for block in blocks if 'package=' + PACKAGE in block]
    assert len(matching) == 1, 'Native media session missing or ambiguous'
    (OUT / 'media-session.txt').write_text(matching[0])
    return matching[0]


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
    assert re.search(r'PlaybackState\s*\{state=3\b', session), 'Native playback stopped in background'
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
    time.sleep(3)
    assert soundcloud_seconds() >= 1, 'Selected queue track is not advancing'
    assert TITLES[1] in app_media_session(), 'Native session did not select the actual queue track'
    screenshot('11-native-queue-track-selection')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    back()
    CHECKS.append('real-queue-drag-preserves-playing-position-and-selects-native-track')


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
        print('Stage: public scan, formats and collection', flush=True)
        prepare_collection()
        print('Stage: resume and real process restart', flush=True)
        resume_acceptance()
        print('Stage: native background playback and real queue gestures', flush=True)
        background_and_queue_acceptance()
        print('Stage: SAF backup export, inspection and restore', flush=True)
        backup_acceptance()
        print('Stage: font, theme and density matrix', flush=True)
        ui_matrix()
        logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
        assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.', logs), 'App runtime failure'
        result = {'status': 'passed', 'commit': commit, 'harnessCommit': os.environ['GITHUB_SHA'], 'apkSha256': sha, 'checks': CHECKS,
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
