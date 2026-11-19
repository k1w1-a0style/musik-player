#!/usr/bin/env python3
"""Public in-place upgrade and long-track acceptance on a fresh emulator."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time

import androidReleaseInteractionSmoke as ui
import androidScanFixSmoke as scan
from androidSmokeDiagnostics import collect_diagnostics

OUT = Path('ci-logs/upgrade-device')
LEGACY_SOURCE = 'd63f4885c08e893864551e8619f94aaeeb9f0ef6'
LEGACY_SHA = '3cf9a5196b40d46701e1abe05f4eb1e18c16019561ea472b01582033dbc732e6'
PREVIEW_SIGNER = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
FOLDER = 'K1W1V7Upgrade'
LEGACY_TITLES = [*scan.TITLES[:2], 'V7 Long MP3']
LONG_DURATION = 3900


def install_receipt(raw):
    result = {}
    for key, pattern in {
        'uid': r'^[ \t]*(?:userId|appId)=(\d+)',
        'firstInstallTime': r'^[ \t]*firstInstallTime=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})',
        'versionCode': r'^[ \t]*versionCode=(\d+)',
        'versionName': r'^[ \t]*versionName=([^\s]+)',
    }.items():
        matches = set(re.findall(pattern, raw, re.M))
        assert len(matches) == 1, 'Installed package receipt missing or ambiguous: ' + key
        result[key] = matches.pop()
    return result


def assert_in_place_upgrade(before, after):
    assert before['versionCode'] == '14' and before['versionName'] == '1.0.2-test.12'
    assert after['versionCode'] == '20' and after['versionName'] == '1.0.2-test.18'
    assert before['uid'] == after['uid'] and before['firstInstallTime'] == after['firstInstallTime'], 'Package was reinstalled from scratch'


def verify_signer(apk):
    build_tools = Path(os.environ['ANDROID_HOME']) / 'build-tools'
    signer = sorted(build_tools.glob('*/apksigner'))[-1]
    report = subprocess.check_output([str(signer), 'verify', '--print-certs', str(apk)], text=True)
    certs = re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})$', report, re.M)
    assert certs == [PREVIEW_SIGNER], 'Unexpected preview signing identity'


def make_fixture(title, ext, codec, seconds):
    path = OUT / (title.replace(' ', '-') + '.' + ext)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000',
                    '-t', str(seconds), '-c:a', codec, '-metadata', 'title=' + title, '-metadata', 'artist=V3 Proof',
                    str(path)], timeout=180, check=True)
    remote = '/sdcard/Music/' + FOLDER + '/' + title.replace(' ', '_') + '.' + ext
    ui.adb('push', str(path), remote, timeout=90)
    ui.adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file://' + remote)
    with path.open('rb') as data:
        digest = hashlib.file_digest(data, 'sha256').hexdigest()
    path.unlink()
    return remote, digest


def row_id(title):
    row = ui.scroll_to(title + ' von V3 Proof', top=True)
    resource = row.get('resource-id', '').split(':id/')[-1]
    assert resource.startswith('song-card-') and row.get('package') == ui.PACKAGE and row.get('enabled') == 'true'
    return resource.removeprefix('song-card-')


def check_favorite(title):
    ui.library_tab('favorites')
    ui.find(title + ' von V3 Proof')
    ui.library_tab('tracks')


def enable_resume():
    scan.open_settings()
    ui.tap_node(ui.scroll_to('settings-group-player', top=True))
    ui.checkbox('settings-resume-enabled', True)
    ui.back()
    ui.wait_uncovered_library_header()


def export_legacy_backup(playlist_ids, favorite_id):
    backup_folder = '/sdcard/Download/V7UpgradeBackup'
    ui.adb('shell', 'mkdir', '-p', backup_folder)
    scan.open_settings()
    ui.tap_node(ui.scroll_to('settings-group-data', top=True))
    ui.tap_node(ui.scroll_to('backup-create', top=True))
    ui.choose_folder(['Download', 'V7UpgradeBackup'])
    ui.find('Backup gespeichert', timeout=45)
    ui.tap('android:id/button1')
    files = ui.adb('shell', 'ls', backup_folder).decode().splitlines()
    assert len(files) == 1 and re.fullmatch(r'[a-zA-Z0-9._-]+', files[0]), 'Legacy backup file missing or unexpected'
    path = backup_folder + '/' + files[0]
    backup = ui.adb('exec-out', 'cat', path)
    data = json.loads(backup)
    assert data['format'] == 'k1w1-musik-backup' and data['version'] == 1
    assert data['favorites'] == [favorite_id]
    assert [entry['songIds'] for entry in data['playlists']] == [playlist_ids]
    ui.back()
    ui.wait_uncovered_library_header()
    return path, hashlib.sha256(backup).hexdigest()


def inspect_legacy_backup(path):
    scan.open_settings()
    ui.tap_node(ui.scroll_to('settings-group-data', top=True))
    ui.tap_node(ui.scroll_to('backup-inspect', top=True))
    ui.choose_folder(['Download', 'V7UpgradeBackup'])
    ui.tap(path.rsplit('/', 1)[1])
    ui.find('backup-preview')
    assert ui.candidate('backup-restore-apply') is None, 'Backup inspection exposed a data mutation action'
    ui.tap_node(ui.scroll_to('Schließen'))
    ui.back()
    ui.wait_uncovered_library_header()


def seek_to_fraction(duration, fraction):
    target = ui.find('Audiospur-Fortschritt')
    x1, y1, x2, y2 = ui.rect(target)
    ui.adb('shell', 'input', 'tap', str(int(x1 + (x2 - x1) * fraction)), str((y1 + y2) // 2))
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        position = ui.classic_position(duration)
        if abs(position - duration * fraction) <= 20:
            return position
        time.sleep(.3)
    raise AssertionError('Long mix did not seek to the requested region')


def assert_long_preview(title):
    node = ui.find('Waveform-Vorschau', timeout=75)
    assert node.get('package') == ui.PACKAGE, 'Waveform preview marker is not owned by the app'
    ui.screenshot('waveform-preview-' + title)


def seed_legacy(legacy):
    ui.adb('install', str(legacy), timeout=180)
    api = int(ui.adb('shell', 'getprop', 'ro.build.version.sdk').decode().strip())
    permission = 'android.permission.READ_MEDIA_AUDIO' if api >= 33 else 'android.permission.READ_EXTERNAL_STORAGE'
    if api >= 33:
        ui.adb('shell', 'pm', 'grant', ui.PACKAGE, 'android.permission.POST_NOTIFICATIONS', check=False)
    ui.public_cold_start()
    scan.add_named_folder(FOLDER)
    ui.find(LEGACY_TITLES[0] + ' von V3 Proof', timeout=150)
    baseline = {title: row_id(title) for title in LEGACY_TITLES}
    ui.adb('shell', 'pm', 'grant', ui.PACKAGE, permission)
    ui.public_cold_start()
    scan.update_library()
    scan.verify_download_visibility(True)
    playlist_ids = scan.create_source_playlist(baseline)
    enable_resume()
    ui.play_title(LEGACY_TITLES[0])
    ui.tap('mini-player-open')
    ui.tap('Titel favorisieren')
    ui.tap('controls-play-pause')
    ui.back()
    check_favorite(LEGACY_TITLES[0])
    backup = export_legacy_backup(playlist_ids, baseline[LEGACY_TITLES[0]])
    ui.play_title(LEGACY_TITLES[2])
    ui.tap('mini-player-open')
    ui.assert_duration(LONG_DURATION)
    seek_to_fraction(LONG_DURATION, .55)
    ui.tap('controls-play-pause')
    pause = ui.wait_paused_session(LEGACY_TITLES[2])
    saved, _ = ui.native_position_clock(pause, LEGACY_TITLES[2], 'PAUSED')
    assert saved > LONG_DURATION / 2
    ui.back()
    ui.adb('shell', 'input', 'keyevent', '3')
    time.sleep(3)
    ui.adb('shell', 'am', 'force-stop', ui.PACKAGE)
    return baseline, playlist_ids, saved, backup


def upgrade(candidate, baseline, playlist_ids, saved, backup):
    before = install_receipt(ui.adb('shell', 'dumpsys', 'package', ui.PACKAGE).decode())
    response = ui.adb('install', '-r', str(candidate), timeout=180).decode()
    assert 'Success' in response, 'Android did not acknowledge the in-place update'
    after = install_receipt(ui.adb('shell', 'dumpsys', 'package', ui.PACKAGE).decode())
    assert_in_place_upgrade(before, after)
    ui.public_cold_start()
    # This scan has to read the existing SAF grant, with no call to the picker.
    scan.update_library()
    counts = scan.wait_scan('upgrade-existing-grant', len(LEGACY_TITLES))
    assert counts.startswith('Neu: 0 · Geändert: 0 · Unverändert: 3')
    assert {title: row_id(title) for title in LEGACY_TITLES} == baseline, 'Upgrade replaced known song IDs'
    scan.verify_download_visibility(False)
    scan.verify_source_playlist(playlist_ids)
    check_favorite(LEGACY_TITLES[0])
    ui.tap('mini-player-play-pause')
    ui.find('Wiedergabe fortsetzen?', timeout=30)
    ui.tap_node(ui.resume_confirmation_button(ui.tree()))
    resumed = ui.wait_playing_session(LEGACY_TITLES[2])
    position, _ = ui.native_position_clock(resumed, LEGACY_TITLES[2], 'PLAYING')
    # The native position is the acknowledged seek base, not UI elapsed time.
    ui.validate_resumed_position(saved, position, 0)
    ui.tap('mini-player-open')
    ui.assert_native_playback(LEGACY_TITLES[2], LONG_DURATION)
    assert_long_preview('mp3')
    ui.tap('controls-play-pause')
    ui.back()
    inspect_legacy_backup(backup[0])
    ui.set_device_music_scope(True)
    scan.update_library()
    scan.verify_download_visibility(True)
    ui.set_device_music_scope(False)
    scan.verify_download_visibility(False)
    return {'before': before, 'after': after, 'sourceCounts': counts, 'savedSeconds': saved, 'resumedSeconds': position}


def exercise_long_formats():
    formats = [('V7LongWAV', 'wav', 'pcm_s16le'), ('V7LongFLAC', 'flac', 'flac')]
    files = dict(make_fixture(title, ext, codec, LONG_DURATION) for title, ext, codec in formats)
    scan.update_library()
    scan.wait_scan('long-file-formats', len(LEGACY_TITLES) + len(formats))
    for title, ext, _ in formats:
        song_title = ui.scroll_to(title, top=True)
        assert song_title.get('package') == ui.PACKAGE and song_title.get('text') == title
        ui.tap_node(song_title)
        ui.wait_selected_session(title)
        ui.tap('mini-player-open')
        ui.assert_duration(LONG_DURATION)
        seek_to_fraction(LONG_DURATION, .75)
        ui.assert_native_playback(title, LONG_DURATION)
        assert_long_preview(ext)
        ui.tap('controls-play-pause')
        ui.back()
    return files


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ui.OUT = scan.OUT = OUT
    legacy = Path('legacy-input/musik-player-preview.apk')
    candidate = Path('preview-input/musik-player-preview.apk')
    source = os.environ['REVIEWED_APK_SOURCE_COMMIT']
    sha = candidate.with_name('apk-sha256.txt').read_text().split()[0]
    emulator = ui.adb('shell', 'getprop', 'ro.kernel.qemu').decode()
    ui.validate_target(legacy, LEGACY_SHA, LEGACY_SOURCE, legacy.with_name('source-commit.txt').read_text(), emulator)
    ui.validate_target(candidate, sha, source, candidate.with_name('source-commit.txt').read_text(), emulator)
    verify_signer(legacy)
    verify_signer(candidate)
    assert not ui.adb('shell', 'pm', 'path', ui.PACKAGE, check=False).strip(), 'Upgrade test requires an isolated app install'
    ui.DEVICE_SERIAL = ui.adb('get-serialno').decode().strip()
    ui.DEVICE_BOOT_ID = ui.adb('shell', 'cat', '/proc/sys/kernel/random/boot_id').decode().strip()
    import uiautomator2
    ui.DEVICE = uiautomator2.connect(ui.DEVICE_SERIAL)
    ui.adb('shell', 'mkdir', '-p', '/sdcard/Music/' + FOLDER)
    files = dict(make_fixture(title, 'mp3', 'libmp3lame', LONG_DURATION if index == 2 else 65)
                 for index, title in enumerate(LEGACY_TITLES))
    download = scan.add_download_fixture()
    files['/sdcard/Download/' + scan.DOWNLOAD_TITLE + '.mp3'] = download
    baseline, playlist_ids, saved, backup = seed_legacy(legacy)
    migration = upgrade(candidate, baseline, playlist_ids, saved, backup)
    files.update(exercise_long_formats())
    assert hashlib.sha256(ui.adb('exec-out', 'cat', backup[0])).hexdigest() == backup[1], 'Original backup was modified'
    for path, digest in files.items():
        actual = ui.adb('shell', 'sha256sum', path, timeout=60).decode().split()[0]
        assert actual == digest, 'The app modified an original fixture: ' + path
    result = {'status': 'upgrade-passed', 'apkSha256': sha, 'sourceCommit': source, 'legacySha256': LEGACY_SHA,
              'api': int(ui.adb('shell', 'getprop', 'ro.build.version.sdk').decode().strip()),
              'migration': migration, 'stableTrackIds': baseline, 'preservedPlaylistIds': playlist_ids,
              'nativePlayback': ui.PLAYBACK_PROOFS, 'longPreviews': ['mp3', 'wav', 'flac'],
              'unchangedOriginals': files, 'legacyBackupSha256': backup[1]}
    (OUT / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    try:
        main()
    finally:
        collect_diagnostics(OUT / 'final', ui.PACKAGE)
