#!/usr/bin/env python3
"""Public in-place upgrade and long-track acceptance on a fresh emulator."""
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
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
LEGACY_TITLES = [*scan.TITLES[:2], 'V7ResumeMP3']
LEGACY_RESUME_DURATION = 1260
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
    assert after['versionCode'] == '21' and after['versionName'] == '1.0.2-test.19'
    assert before['uid'] == after['uid'] and before['firstInstallTime'] == after['firstInstallTime'], 'Package was reinstalled from scratch'


def signer_fingerprint(report):
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in report, 'APK v2 verification failed'
    certificates = re.findall(r'-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----', report)
    assert len(certificates) == 1, 'Expected exactly one APK signing certificate'
    return hashlib.sha256(ssl.PEM_cert_to_DER_cert(certificates[0])).hexdigest()


def verify_signer(apk):
    build_tools = Path(os.environ['ANDROID_HOME']) / 'build-tools'
    signer = sorted(build_tools.glob('*/apksigner'))[-1]
    report = subprocess.check_output([str(signer), 'verify', '--verbose', '--print-certs-pem', str(apk)], text=True)
    assert signer_fingerprint(report) == PREVIEW_SIGNER, 'Unexpected preview signing identity'


def make_fixture(title, ext, codec, seconds):
    path = OUT / (title.replace(' ', '-') + '.' + ext)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=22050',
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
    # The old release publishes file rows as native base metadata settles.
    row = ui.find(title + ' von V3 Proof', timeout=120)
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


def trigger_backup_export(folder):
    scan.open_settings()
    ui.tap_node(ui.scroll_to('settings-group-data', top=True))
    ui.tap_node(ui.scroll_to('backup-create', top=True))
    ui.choose_folder(['Download', folder])
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        frame = ui.tree(compressed=False)
        if ui.candidate('Backup gespeichert', frame) is not None:
            ui.tap('android:id/button1')
            return True
        failure = ui.candidate('Backup nicht abgeschlossen', frame)
        if failure is not None:
            message = ui.candidate('android:id/message', frame)
            assert failure.get('package') == ui.PACKAGE and message is not None
            assert 'OutOfMemoryError' in message.get('text', ''), 'Backup export reported an unexpected failure'
            ui.screenshot('backup-export-heap-exhausted-' + folder)
            ui.tap('android:id/button1')
            return False
        time.sleep(.3)
    raise AssertionError('Backup export did not publish its success or failure receipt')


def export_backup(folder, playlist_ids, favorite_id, legacy=False):
    backup_folder = '/sdcard/Download/' + folder
    ui.adb('shell', 'mkdir', '-p', backup_folder)
    ui.wait_collection_idle()
    saved = trigger_backup_export(folder)
    if legacy and not saved:
        # test.12 can exhaust the API 29 heap during its 12 MiB read-back.
        # Retry only after the exact error and a real cold-start recovery.
        ui.public_cold_start()
        ui.wait_collection_idle()
        saved = trigger_backup_export(folder)
    assert saved, 'Backup was not saved with a confirmed read-back'
    files = ui.adb('shell', 'ls', backup_folder).decode().splitlines()
    assert len(files) == 1 and re.fullmatch(r'[a-zA-Z0-9._-]+', files[0]), 'Legacy backup file missing or unexpected'
    path = backup_folder + '/' + files[0]
    backup = ui.adb('exec-out', 'cat', path)
    data = json.loads(backup)
    assert data['format'] == 'k1w1-musik-backup' and data['version'] == 1
    assert data['favorites'] == [favorite_id]
    assert [entry['songIds'] for entry in data['playlists']] == [playlist_ids]
    leave_backup_settings()
    return path, hashlib.sha256(backup).hexdigest()


def open_backup_inspection(path):
    scan.open_settings()
    ui.tap_node(ui.scroll_to('settings-group-data', top=True))
    ui.tap_node(ui.scroll_to('backup-inspect', top=True))
    ui.choose_folder(['Download', 'V7UpgradeBackup'])
    ui.tap(path.rsplit('/', 1)[1])
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        frame = ui.tree(compressed=False)
        if ui.candidate('backup-preview', frame) is not None:
            return frame
        busy = ui.candidate('Sammlung wird bearbeitet', frame)
        if busy is not None:
            notice = ui.candidate('Bitte warte auf den Abschluss des laufenden Scans oder der Metadatenbearbeitung.', frame)
            assert busy.get('package') == ui.PACKAGE and notice is not None and notice.get('package') == ui.PACKAGE
            ui.screenshot('backup-inspection-busy-guard')
            ui.tap('android:id/button1')
            leave_backup_settings()
            return None
        time.sleep(.25)
    raise AssertionError('Backup inspection acknowledged neither a preview nor a collection-busy guard')


def inspect_legacy_backup(path, playlist_ids):
    ui.wait_collection_idle()
    ui.quiesce_optional_preparation()
    frame = open_backup_inspection(path)
    if frame is None:
        # The provider may finish selection while enrichment is starting.
        # Retry only the acknowledged busy guard and wait for real idle first.
        ui.wait_collection_idle()
        ui.quiesce_optional_preparation()
        frame = open_backup_inspection(path)
    assert frame is not None, 'Backup inspection refused twice while the collection was busy'
    assert ui.candidate('backup-restore-apply', frame) is None, 'Backup inspection exposed a data mutation action'
    for song_id in playlist_ids:
        reference = ui.candidate('backup-reference-' + song_id, frame)
        assert reference is not None and reference.get('package') == ui.PACKAGE and ', zugeordnet,' in reference.get('content-desc', '')
    ui.screenshot('legacy-backup-mapped-by-original-song-ids')
    (OUT / 'backup-inspection-receipt.json').write_text(json.dumps({'mappedIds': playlist_ids, 'readOnly': True}, indent=2))
    # Back is the modal's public onRequestClose action. The close button sits
    # in a virtualized footer that need not be mounted when mappings are visible.
    ui.back()
    settings = ui.tree(compressed=False)
    assert ui.candidate('backup-preview', settings) is None and ui.candidate('settings-screen', settings) is not None
    leave_backup_settings()


def leave_backup_settings():
    target = ui.find('Navigate up')
    assert target.get('package') == ui.PACKAGE and target.get('enabled') == 'true'
    ui.tap_node(target)
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
    backup = export_backup('V7UpgradeBackup', playlist_ids, baseline[LEGACY_TITLES[0]], legacy=True)
    ui.play_title(LEGACY_TITLES[2])
    ui.tap('mini-player-open')
    ui.assert_duration(LEGACY_RESUME_DURATION)
    seek_to_fraction(LEGACY_RESUME_DURATION, .55)
    ui.tap('controls-play-pause')
    pause = ui.wait_paused_session(LEGACY_TITLES[2])
    saved, _ = ui.native_position_clock(pause, LEGACY_TITLES[2], 'PAUSED')
    assert saved > LEGACY_RESUME_DURATION / 2
    ui.back()
    ui.adb('shell', 'input', 'keyevent', '3')
    time.sleep(3)
    ui.adb('shell', 'am', 'force-stop', ui.PACKAGE)
    return baseline, playlist_ids, saved, backup


def upgrade(candidate, baseline, playlist_ids, saved):
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
    ui.assert_native_playback(LEGACY_TITLES[2], LEGACY_RESUME_DURATION)
    ui.tap('controls-play-pause')
    ui.back()
    ui.set_device_music_scope(True)
    scan.update_library()
    scan.verify_download_visibility(True)
    ui.set_device_music_scope(False)
    scan.verify_download_visibility(False)
    return {'before': before, 'after': after, 'sourceCounts': counts, 'savedSeconds': saved, 'resumedSeconds': position}


def exercise_long_formats():
    formats = [('V7LongMP3', 'mp3', 'libmp3lame'), ('V7LongWAV', 'wav', 'pcm_s16le'),
               ('V7LongFLAC', 'flac', 'flac')]
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
    files = dict(make_fixture(title, 'mp3', 'libmp3lame', LEGACY_RESUME_DURATION if index == 2 else 65)
                 for index, title in enumerate(LEGACY_TITLES))
    download = scan.add_download_fixture()
    files['/sdcard/Download/' + scan.DOWNLOAD_TITLE + '.mp3'] = download
    print('Stage: seed the original installation through the public UI', flush=True)
    baseline, playlist_ids, saved, backup = seed_legacy(legacy)
    print('Stage: upgrade in place and confirm persisted access and user state', flush=True)
    migration = upgrade(candidate, baseline, playlist_ids, saved)
    assert hashlib.sha256(ui.adb('exec-out', 'cat', backup[0])).hexdigest() == backup[1], 'Original backup was modified'
    _, candidate_backup_hash = export_backup('V7VerifiedBackup', playlist_ids, baseline[LEGACY_TITLES[0]])
    (OUT / 'migration-receipt.json').write_text(json.dumps({
        'apkSha256': sha, 'legacySha256': LEGACY_SHA, 'sourceCommit': source, 'migration': migration,
        'stableTrackIds': baseline, 'preservedPlaylistIds': playlist_ids, 'legacyBackupSha256': backup[1],
        'candidateBackupSha256': candidate_backup_hash,
    }, indent=2))
    print('Stage: seek and play real 65-minute MP3, WAV and FLAC files after upgrade', flush=True)
    files.update(exercise_long_formats())
    print('Stage: inspect the old backup with its original track IDs', flush=True)
    inspect_legacy_backup(backup[0], playlist_ids)
    for path, digest in files.items():
        actual = ui.adb('shell', 'sha256sum', path, timeout=60).decode().split()[0]
        assert actual == digest, 'The app modified an original fixture: ' + path
    result = {'status': 'upgrade-passed', 'apkSha256': sha, 'sourceCommit': source, 'legacySha256': LEGACY_SHA,
              'api': int(ui.adb('shell', 'getprop', 'ro.build.version.sdk').decode().strip()),
              'migration': migration, 'stableTrackIds': baseline, 'preservedPlaylistIds': playlist_ids,
              'nativePlayback': ui.PLAYBACK_PROOFS, 'longPreviews': ['mp3', 'wav', 'flac'],
              'unchangedOriginals': files, 'legacyBackupSha256': backup[1], 'candidateBackupSha256': candidate_backup_hash}
    (OUT / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    try:
        main()
    finally:
        collect_diagnostics(OUT / 'final', ui.PACKAGE)
