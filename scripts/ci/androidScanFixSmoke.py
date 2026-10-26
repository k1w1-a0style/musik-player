#!/usr/bin/env python3
"""Exact test APK diagnostics on isolated Android 10/15 using synthetic audio and public UI."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
import androidReleaseInteractionSmoke as ui

TITLES = [f'K1W1 Scan {i:02}' for i in range(1, 13)]
OUT = Path('ci-logs/scan-device')


def scan_receipt(root, expected, partial=False):
    texts = [n.get('text', '') for n in root.iter('node') if n.get('package') == ui.PACKAGE]
    terminal = 'Aktualisierung – teilweise abgeschlossen' if partial else 'Aktualisierung – abgeschlossen'
    assert terminal in texts, 'The public scan has not reached its expected honest terminal state'
    assert f'{expected} von {expected} gefundenen Dateien verarbeitet' in texts, 'The scan left a pending tail'
    counts = next((text for text in texts if text.startswith('Neu: ')), '')
    pattern = r'Leseprobleme: [1-9]\d*(?:\D|$)' if partial else r'Leseprobleme: 0(?:\D|$)'
    assert re.search(pattern, counts), 'Read problems do not match the expected source outcome'
    return counts


def wait_scan(name, expected=12, partial=False, details_delay=0):
    if details_delay:
        time.sleep(details_delay)
    ui.tap('Verarbeitungsdetails öffnen')
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        root = ui.tree(compressed=False)
        try:
            counts = scan_receipt(root, expected, partial)
            ui.screenshot(name)
            (OUT / (name + '.xml')).write_text(ET.tostring(root, encoding='unicode'))
            ui.tap('Verarbeitungsdetails schließen')
            return counts
        except AssertionError:
            if not partial and ui.candidate('Aktualisierung – teilweise abgeschlossen', root) is not None:
                raise AssertionError('One scan did not process the whole synthetic folder')
            time.sleep(.5)
    raise AssertionError('Synthetic folder did not complete in a single scan')


def make_audio():
    directory = OUT / 'synthetic-audio'
    directory.mkdir(parents=True, exist_ok=True)
    for index, title in enumerate(TITLES):
        extension, codec = [('mp3', 'libmp3lame'), ('m4a', 'aac'), ('flac', 'flac')][index % 3]
        target = directory / f'ScanFix-{index+1:02}.{extension}'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'sine=frequency={330+index*20}:sample_rate=22050',
                        '-t', '65', '-c:a', codec, '-metadata', 'title=' + title, '-metadata', 'artist=V3 Proof', str(target)], check=True)
    ui.adb('shell', 'mkdir', '-p', '/sdcard/Music/K1W1ScanFix')
    for target in directory.iterdir():
        ui.adb('push', str(target), '/sdcard/Music/K1W1ScanFix/' + target.name)
        ui.adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', 'file:///sdcard/Music/K1W1ScanFix/' + target.name)
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir()}


def verify_rows():
    identifiers = {}
    for title in TITLES:
        node = ui.scroll_to(title + ' von V3 Proof', top=True)
        assert node.get('package') == ui.PACKAGE and node.get('enabled') == 'true'
        identifiers[title] = node.get('resource-id', '').split(':id/')[-1].removeprefix('song-card-')
    assert len(set(identifiers.values())) == len(TITLES), 'Duplicate or missing track IDs'
    return identifiers


def open_settings():
    ui.wait_uncovered_library_header()
    ui.tap('library-open-menu')
    ui.find('library-menu-card')
    ui.tap_node(ui.scroll_to('library-menu-item-einstellungen'))
    ui.find('settings-screen')


def update_library():
    ui.wait_uncovered_library_header()
    ui.tap('library-open-menu')
    ui.tap('library-menu-item-musikbibliothek-aktualisieren')


def add_named_folder(name):
    ui.wait_uncovered_library_header()
    ui.tap('library-open-menu')
    ui.tap('library-menu-item-ordner-hinzuf-gen')
    ui.choose_folder(['Music', name] if name else ['Music'])


def folder_remove_actions(frame):
    return [node for node in frame.iter('node') if node.get('package') == ui.PACKAGE
            and node.get('resource-id', '').split(':id/')[-1].startswith('remove-folder-')]


def remove_named_folder(name):
    ui.library_tab('folders')
    label = 'Scan-Ordner ' + name + ' entfernen'
    target = ui.find(label)
    assert target.get('package') == ui.PACKAGE and ui.rect(target)[3] - ui.rect(target)[1] >= 72
    ui.tap_node(target)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if ui.candidate(label, ui.tree(compressed=False)) is None:
            ui.library_tab('tracks')
            return
        time.sleep(.3)
    raise AssertionError('Removed folder remains in the active source list')


def assert_empty_active_library():
    ui.library_tab('tracks')
    ui.find('Keine Treffer gefunden.')
    frame = ui.tree(compressed=False)
    assert not any(node.get('package') == ui.PACKAGE and node.get('resource-id', '').split(':id/')[-1].startswith('song-card-')
                   for node in frame.iter('node')), 'A source-less track remains in the active library'
    ui.screenshot('inactive-library-with-preserved-records')


def create_source_playlist(baseline):
    ui.library_tab('playlists')
    ui.create_public_playlist('SourceProof')
    ui.tap('Playlist SourceProof')
    ui.tap('playlist-detail-add-button')
    ui.add_public_playlist_songs(TITLES[:2])
    ui.tap('playlist-detail-add-close')
    identifiers = [baseline[title] for title in TITLES[:2]]
    ui.validate_playlist_contents(ui.tree(compressed=False), identifiers, TITLES[:2])
    ui.back(); ui.library_tab('tracks')
    return identifiers


def verify_source_playlist(identifiers):
    ui.library_tab('playlists'); ui.tap('Playlist SourceProof')
    ui.validate_playlist_contents(ui.tree(compressed=False), identifiers, TITLES[:2])
    ui.screenshot('playlist-preserved-with-inactive-source')
    ui.back(); ui.library_tab('tracks')


def verify_system_music_grant(permission, api):
    state = ui.adb('shell', 'dumpsys', 'package', ui.PACKAGE).decode()
    (OUT / 'system-music-permission-granted.txt').write_text(state)
    assert re.search(re.escape(permission) + r':\s+granted=true', state), 'Android did not grant read access'
    assert not re.search(r'android.permission.WRITE_EXTERNAL_STORAGE:\s+granted=true', state), 'Test must exercise pure read access'
    if api == 29:
        ui.adb('shell', 'am', 'start', '-W', '-a', 'android.settings.APPLICATION_DETAILS_SETTINGS', '-d', 'package:' + ui.PACKAGE)
        ui.tap('Permissions'); ui.find('Storage')
        root = ui.tree(compressed=False)
        assert any(node.get('text', '').strip().lower() == 'allowed' for node in root.iter('node')), 'Android Storage permission is not visibly Allowed'
        ui.screenshot('android10-storage-access-allowed')
    return {'permission': permission, 'granted': True, 'writeGranted': False}


def main():
    apk = Path('preview-input/musik-player-preview.apk')
    expected = Path('preview-input/apk-sha256.txt').read_text().split()[0]
    ui.validate_target(apk, expected, os.environ.get('REVIEWED_APK_SOURCE_COMMIT', os.environ['GITHUB_SHA']), Path('preview-input/source-commit.txt').read_text(),
                       ui.adb('shell', 'getprop', 'ro.kernel.qemu').decode())
    OUT.mkdir(parents=True, exist_ok=True)
    ui.OUT = OUT
    ui.DEVICE_SERIAL = ui.adb('get-serialno').decode().strip()
    ui.DEVICE_BOOT_ID = ui.adb('shell', 'cat', '/proc/sys/kernel/random/boot_id').decode().strip()
    import uiautomator2
    ui.DEVICE = uiautomator2.connect(ui.DEVICE_SERIAL)
    fixtures = make_audio()
    ui.adb('install', '-r', str(apk), timeout=180)
    api = int(ui.adb('shell', 'getprop', 'ro.build.version.sdk').decode().strip())
    if api >= 33:
        ui.adb('shell', 'pm', 'grant', ui.PACKAGE, 'android.permission.POST_NOTIFICATIONS', check=False)
    ui.adb('logcat', '-c')
    ui.public_cold_start()
    ui.tap('library-open-menu')
    ui.tap('library-menu-item-ordner-hinzuf-gen')
    ui.choose_folder(['Music', 'K1W1ScanFix'])
    first = wait_scan('first-single-saf-scan')
    assert first.startswith('Neu: 12 · Geändert: 0'), 'All twelve files must be new in the single initial scan'
    baseline = verify_rows()
    playlist_ids = create_source_playlist(baseline)
    ui.tap('library-open-menu')
    ui.tap('library-menu-item-musikbibliothek-aktualisieren')
    repeated = wait_scan('repeated-incremental-scan')
    assert repeated.startswith('Neu: 0 · Geändert: 0 · Unverändert: 12'), 'Repeated update reimported existing audio'
    remove_named_folder('K1W1ScanFix')
    assert_empty_active_library()
    verify_source_playlist(playlist_ids)
    ui.public_cold_start()
    assert_empty_active_library()
    add_named_folder('K1W1ScanFix')
    readded = wait_scan('readded-folder-cache-reuse')
    assert readded.startswith('Neu: 0 · Geändert: 0 · Unverändert: 12')
    assert verify_rows() == baseline, 'Re-adding the folder changed track IDs'
    permission = 'android.permission.READ_MEDIA_AUDIO' if api >= 33 else 'android.permission.READ_EXTERNAL_STORAGE'
    ui.adb('shell', 'pm', 'grant', ui.PACKAGE, permission)
    permission_proof = verify_system_music_grant(permission, api)
    ui.public_cold_start()
    combined = wait_scan('granted-mediastore-and-saf', 24)
    assert combined.startswith('Neu: 0 · Geändert: 0 · Unverändert: 24')
    assert verify_rows() == baseline, 'MediaStore and SAF produced duplicate or changed track IDs'
    # A temporarily unreachable empty SAF root must stay registered while the
    # twelve real tracks remain usable through the other sources.
    ui.adb('shell', 'mkdir', '-p', '/sdcard/Music/K1W1TransientSource')
    add_named_folder('K1W1TransientSource')
    ui.library_tab('folders')
    ui.adb('shell', 'mv', '/sdcard/Music/K1W1TransientSource', '/sdcard/Music/K1W1TransientSource-offline')
    ui.library_tab('tracks'); update_library()
    partial = wait_scan('unreadable-saf-healthy-mediastore', 24, partial=True)
    assert verify_rows() == baseline
    ui.library_tab('folders')
    assert len(folder_remove_actions(ui.tree(compressed=False))) == 2, 'Unreadable folder was silently removed'
    ui.adb('shell', 'mv', '/sdcard/Music/K1W1TransientSource-offline', '/sdcard/Music/K1W1TransientSource')
    ui.library_tab('tracks'); update_library()
    wait_scan('recovered-saf-source', 24)
    remove_named_folder('K1W1ScanFix')
    assert verify_rows() == baseline, 'Removing SAF hid tracks still authorized through MediaStore'
    update_library(); media_only = wait_scan('granted-mediastore-without-music-saf', 12)
    assert media_only.startswith('Neu: 0 · Geändert: 0 · Unverändert: 12')
    add_named_folder('K1W1ScanFix'); wait_scan('restore-music-source', details_delay=6)
    add_named_folder(None); wait_scan('overlapping-parent-source')
    ui.adb('shell', 'pm', 'revoke', ui.PACKAGE, permission)
    ui.public_cold_start(); wait_scan('restart-with-only-overlapping-saf', 24)
    remove_named_folder('K1W1ScanFix')
    assert verify_rows() == baseline, 'Overlapping parent source was lost'
    remove_named_folder('Music')
    assert_empty_active_library(); verify_source_playlist(playlist_ids)
    add_named_folder('K1W1ScanFix'); wait_scan('restore-after-overlap-removal')
    assert verify_rows() == baseline
    ui.play_title(TITLES[0])
    ui.tap('mini-player-open')
    ui.assert_duration(65)
    ui.assert_native_playback(TITLES[0], 65)
    ui.tap('controls-play-pause')
    ui.back()
    ui.adb('shell', 'settings', 'put', 'system', 'font_scale', '2.0')
    ui.wait_uncovered_library_header()
    last = ui.scroll_to(TITLES[-1] + ' von V3 Proof')
    mini = ui.find('mini-player-open')
    assert ui.rect(last)[3] <= ui.rect(mini)[1], 'Mini-player permanently hides the last track at 200% font scale'
    ui.screenshot('last-track-font2-above-mini-player')
    open_settings()
    categories = []
    for group in ('appearance', 'player', 'motion', 'library', 'data'):
        node = ui.scroll_to('settings-group-' + group, top=True)
        bounds = ui.rect(node)
        assert node.get('package') == ui.PACKAGE and bounds[3] - bounds[1] >= 72
        categories.append({'group': group, 'bounds': bounds})
    ui.screenshot('settings-five-categories-font2')
    ui.tap_node(ui.scroll_to('settings-group-library', top=True))
    for key in ('settings-library-update-onOpen', 'settings-library-update-whileOpen', 'settings-density-compact', 'settings-tag-cleaner'):
        node = ui.scroll_to(key, top=True)
        assert node.get('enabled') == 'true', 'A preserved library setting is inaccessible: ' + key
    ui.tap_node(ui.scroll_to('settings-group-data', top=True))
    for key in ('backup-create', 'backup-inspect', 'backup-select-restore'):
        assert ui.scroll_to(key, top=True).get('enabled') == 'true'
    ui.screenshot('backup-actions-font2')
    logs = ui.adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
    (OUT / 'logcat.txt').write_text(logs)
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|ANR in ' + re.escape(ui.PACKAGE), logs), 'App runtime failure'
    result = {'status': 'diagnostics-passed', 'releaseAccepted': False, 'api': api, 'sourceCommit': os.environ.get('REVIEWED_APK_SOURCE_COMMIT', os.environ['GITHUB_SHA']), 'harnessCommit': os.environ['GITHUB_SHA'],
              'apkSha256': expected, 'syntheticFixtures': fixtures, 'firstScanCounts': first, 'repeatScanCounts': repeated,
              'restartRows': len(TITLES), 'readdedCounts': readded, 'combinedCounts': combined, 'partialSourceCounts': partial,
              'mediaOnlyCounts': media_only, 'systemPermission': permission_proof, 'stableTrackIds': baseline, 'preservedPlaylistIds': playlist_ids, 'nativePlayback': ui.PLAYBACK_PROOFS, 'fontScale': 2, 'settingsCategories': categories, 'launcherDialogs': ui.LAUNCHER_DIALOGS,
              'limitations': ['no physical Samsung provider', 'permanently blocked provider behavior covered by host regressions, not this device fixture',
                              'security and full release acceptance remain independent requirements']}
    (OUT / 'result.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    try:
        main()
    finally:
        from androidSmokeDiagnostics import collect_diagnostics
        collect_diagnostics(OUT / 'final', ui.PACKAGE)
