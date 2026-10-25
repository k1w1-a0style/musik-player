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


def scan_receipt(root, expected):
    texts = [n.get('text', '') for n in root.iter('node') if n.get('package') == ui.PACKAGE]
    assert 'Schnellscan – abgeschlossen' in texts, 'The public scan has not completed successfully'
    assert f'{expected} von {expected} gefundenen Dateien verarbeitet' in texts, 'The scan left a pending tail'
    counts = next((text for text in texts if text.startswith('Neu: ')), '')
    assert re.search(r'Leseprobleme: 0(?:\D|$)', counts), 'The scan reported a read failure'
    return counts


def wait_scan(name):
    ui.tap('Verarbeitungsdetails öffnen')
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        root = ui.tree(compressed=False)
        try:
            counts = scan_receipt(root, len(TITLES))
            ui.screenshot(name)
            (OUT / (name + '.xml')).write_text(ET.tostring(root, encoding='unicode'))
            ui.tap('Verarbeitungsdetails schließen')
            return counts
        except AssertionError:
            if ui.candidate('Schnellscan – teilweise abgeschlossen', root) is not None:
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
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir()}


def verify_rows():
    for title in TITLES:
        node = ui.scroll_to(title + ' von V3 Proof', top=True)
        assert node.get('package') == ui.PACKAGE and node.get('enabled') == 'true'


def open_settings():
    ui.wait_uncovered_library_header()
    ui.tap('library-open-menu')
    ui.tap_node(ui.scroll_to('library-menu-item-einstellungen'))
    ui.find('settings-screen')


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
    verify_rows()
    ui.tap('library-open-menu')
    ui.tap('library-menu-item-musikbibliothek-aktualisieren')
    ui.tap('Nur Scan-Ordner')
    repeated = wait_scan('repeated-incremental-scan')
    assert repeated.startswith('Neu: 0 · Geändert: 0 · Unverändert: 12'), 'Repeated update reimported existing audio'
    ui.public_cold_start()
    verify_rows()
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
              'restartRows': len(TITLES), 'nativePlayback': ui.PLAYBACK_PROOFS, 'fontScale': 2, 'settingsCategories': categories, 'launcherDialogs': ui.LAUNCHER_DIALOGS,
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
