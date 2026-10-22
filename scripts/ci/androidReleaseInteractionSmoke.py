#!/usr/bin/env python3
"""Release-APK acceptance on an isolated emulator, using only public Android UI.

No Metro, run-as, private database writes, injected playlists or debug APK.
"""
from androidCleanerGeometry import validate_targets, validate_disjoint
from androidSettingsNavigation import settings_control_order, color_target_for
import hashlib
import http.client
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.k1w1a0style.musikplayer'
OUT = Path('ci-logs/font2-regression' if os.environ.get('APK_DIAGNOSTIC_MODE') == 'v5-section-font2' else 'ci-logs/release-interaction')
CHECKS = []
PLAYBACK_PROOFS = []
PLAYLIST_ADD_PROOFS = []
SCROLL_PROOFS = []
DEVICE = None
DEVICE_SERIAL = None
DEVICE_BOOT_ID = None
TRANSPORT_RECOVERIES = []
LAUNCHER_DIALOGS = 0
TITLES = ['V3 MP3 langer deutscher Titel zum Prüfen der Bedienbarkeit', 'V3 M4A', 'V3 FLAC', 'V3 Mix 21 Minuten']
FORMAT_DURATIONS = (90, 120, 150, 1260)
ACCENT_IDS = ('cover', 'green', 'cyan', 'turquoise', 'blue', 'violet', 'purple', 'pink', 'red', 'orange', 'yellow', 'neutral')
CLEANER_TITLE = 'V5  Cleaner'
CLEANER_ARTIST = 'V5  Proof'
CLEANER_TARGET = '/sdcard/Music/V5OnlySAF/V5-cleaner.mp3'
V5_PROOFS = {}
COMPACT_SETTINGS = False
SETTINGS_COLOR_TARGET = 'appAccent'
UI_SNAPSHOTS = {"compact": 0, "full": 0, "seconds": 0.0}
RETEST_ONLY_PATHS = frozenset({
    'scripts/ci/androidReleaseInteractionSmoke.py',
    'scripts/ci/androidReleaseInteractionSmoke_test.py',
    '.github/workflows/android-release-retest.yml',
    'docs/CODEX-V3-IMPLEMENTATION.md', 'docs/CODEX-V5-IMPLEMENTATION.md',
    'docs/CODEX-V5-CHECKPOINTS.md',
})


def adb(*args, check=True, timeout=30):
    return subprocess.run(['adb', *args], check=check, capture_output=True, timeout=timeout).stdout


def validate_target(apk, expected_sha, reviewed_commit, artifact_commit, emulator):
    assert emulator.strip() == '1', 'Release UI acceptance may run only on an isolated emulator'
    assert re.fullmatch(r'[0-9a-f]{40}', reviewed_commit), 'Missing immutable reviewed source'
    assert reviewed_commit == artifact_commit.strip(), 'APK artifact belongs to a different source commit'
    assert hashlib.sha256(Path(apk).read_bytes()).hexdigest() == expected_sha, 'APK bytes differ from inspected artifact'


def validate_completed_font2_stage(data, run, jobs, artifact, source, apk_sha):
    """Retain only the immutable successful first stage of this exact APK."""
    harness = 'f5ff31bef3dfc9457f6d4b5710ab0ea9539157b5'
    assert run['id'] == 38773283526 and run['head_sha'] == harness and run['status'] == 'completed'
    assert len(jobs) == 1 and jobs[0]['head_sha'] == harness and jobs[0]['status'] == 'completed'
    for name in ('Verify the acceptance harness regressions before device work',
                 'Reject changed app sources, failed original gates or altered APK bytes',
                 'Verify twelve affected font2 variants on the new APK'):
        steps = [s for s in jobs[0]['steps'] if s['name'] == name]
        assert len(steps) == 1 and steps[0]['conclusion'] == 'success', 'Completed font2 provenance or stage failed'
    assert artifact['id'] == 11994031824 and artifact['workflow_run']['id'] == run['id']
    assert artifact['workflow_run']['head_sha'] == harness and artifact['expired'] is False
    assert artifact['digest'] == 'sha256:f1e4a4f0179fcc2c6eb3f9fd1324797ca28468820ad950e8fd918f9536f2f865'
    assert data['sourceCommit'] == source and data['apkSha256'] == apk_sha and data['harnessCommit'] == harness
    assert data['status'] == 'stage-only-passed' and data['mode'] == 'v5-section-font2' and data['releaseAccepted'] is False
    validate_font2_matrix_coverage(data['v5Proofs']['matrix'])
    return {'run':run['id'],'harnessCommit':harness,'artifact':artifact['id'],
            'artifactDigest':artifact['digest'],'sourceCommit':source,'apkSha256':apk_sha,'passed':12}


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


def transport_error(error):
    return isinstance(error, (json.JSONDecodeError, http.client.RemoteDisconnected,
                              ConnectionResetError, BrokenPipeError)) or \
        (type(error).__module__, type(error).__name__) in {
            ('uiautomator2.exceptions', 'HTTPError'), ('adbutils.errors', 'AdbError')}


def dump_hierarchy(compressed):
    global DEVICE
    try:
        return DEVICE.dump_hierarchy(compressed=compressed, max_depth=80)
    except Exception as error:
        if not transport_error(error) or not DEVICE_SERIAL or not DEVICE_BOOT_ID or TRANSPORT_RECOVERIES:
            raise
        record = {'error': repr(error), 'serial': DEVICE_SERIAL, 'bootId': DEVICE_BOOT_ID, 'status': 'attempting'}
        TRANSPORT_RECOVERIES.append(record)
        (OUT / 'transport-recovery.json').write_text(json.dumps(TRANSPORT_RECOVERIES, indent=2))
        adb('-s', DEVICE_SERIAL, 'wait-for-device', timeout=30)
        boot_id = adb('-s', DEVICE_SERIAL, 'shell', 'cat', '/proc/sys/kernel/random/boot_id').decode().strip()
        assert boot_id == DEVICE_BOOT_ID, 'Emulator rebooted during UI transport failure'
        logs = adb('-s', DEVICE_SERIAL, 'logcat', '-d', '-v', 'threadtime').decode(errors='replace')
        (OUT / 'transport-recovery-logcat.txt').write_text(logs)
        assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'Runtime failure before UI transport recovery'
        import uiautomator2
        DEVICE = uiautomator2.connect(DEVICE_SERIAL)
        raw = DEVICE.dump_hierarchy(compressed=compressed, max_depth=80)
        record['status'] = 'recovered-same-boot-no-app-restart'
        (OUT / 'transport-recovery.json').write_text(json.dumps(TRANSPORT_RECOVERIES, indent=2))
        print('Recovered UI transport once on the same emulator boot; app not restarted.', flush=True)
        return raw


def tree(compressed=True):
    started = time.perf_counter()
    raw = dump_hierarchy(compressed)
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
            cleaner_action = key.startswith('tag-cleaner-') and node.get('clickable') == 'true'
            # Full-width buttons are legitimate. At a vertical clip edge,
            # however, even >=48dp of a tall font2 button can hide its label.
            if cleaner_action and (y1 <= sy1 or y2 >= sy2):
                return None
            if (key.startswith(('song-card-info-', 'library-menu-item-')) or cleaner_action) and (x2-x1 < 72 or y2-y1 < 72):
                # Android can report already-clipped child bounds exactly at the
                # parent edge; inside-parent geometry alone is not whole visibility.
                if x1 <= sx1 or x2 >= sx2 or y1 <= sy1 or y2 >= sy2:
                    return None
            return node if sx1 <= x1 and sy1 <= y1 and x2 <= sx2 and y2 <= sy2 else None
        ancestor = parents.get(ancestor)
    return node


def vertical_swipe_coordinates(root, key, down=False, precise=False):
    # Status cards, font scale and the mini player change the actual viewport.
    # Never start in a header/card or drag through unrelated controls.
    x1, y1, x2, y2 = scroll_bounds(root, key)
    inset = max(16, int((y2-y1)*(.30 if precise else .15)))
    x, upper, lower = (x1+x2)//2, y1+inset, y2-inset
    assert lower-upper >= 16, 'Vertical scroll surface is too small: ' + key
    return (x, upper, x, lower) if down else (x, lower, x, upper)


def scroll_query_frame(key):
    frame = tree()
    full_required = candidate(key, frame) is None
    try:
        if scroll_candidate(key, frame) is None:
            vertical_scroll_surface(frame, key)
    except AssertionError:
        full_required = True
    if full_required:
        # Compact trees can prune either the owner OR a target control.
        # Check the exact full tree before scrolling past an omitted switch.
        frame = tree(compressed=False)
        if scroll_candidate(key, frame) is None:
            vertical_scroll_surface(frame, key)
    if key == 'settings-instant-colors':
        controls = [{'id': n.get('resource-id'), 'label': n.get('content-desc'),
                     'class': n.get('class'), 'bounds': n.get('bounds'), 'checked': n.get('checked')}
                    for n in frame.iter('node') if 'Switch' in n.get('class', '') or matches(n, key)]
        texts = [n.get('text') for n in frame.iter('node') if n.get('text')]
        print('INSTANT_SCROLL ' + json.dumps({'full': full_required, 'controls': controls,
              'texts': texts}, ensure_ascii=False), flush=True)
        (OUT / ('instant-scroll-frame-' + str(UI_SNAPSHOTS['compact'] + UI_SNAPSHOTS['full']) + '.xml')).write_text(ET.tostring(frame, encoding='unicode'))
    return frame


def settings_scroll_direction(frame, key):
    target = settings_control_order(key)
    if target is None:
        return None
    owner = vertical_scroll_surface(frame,key)
    if not matches(owner,'settings-scroll') or owner.get('package') != PACKAGE:
        return None
    observed = [settings_control_order(node.get('resource-id','').split(':id/')[-1])
                for node in owner.iter('node') if visible(node) and node.get('package') == PACKAGE]
    orders = [order for order in observed if order is not None]
    if orders and target < min(orders):
        return True
    if orders and target > max(orders):
        return False
    return None


def scroll_to(key, top=False, limit=24):
    global SETTINGS_COLOR_TARGET
    target = color_target_for(key) if COMPACT_SETTINGS else None
    if target and target != SETTINGS_COLOR_TARGET:
        tap_node(scroll_to('settings-color-target-' + target, top=True))
        SETTINGS_COLOR_TARGET = target
    return scroll_to_visible(key, top, limit)


def scroll_to_visible(key, top=False, limit=24):
    down, previous, previous_direction, stable = top, None, None, 0
    # Keep the original total gesture budget. Change direction at an observed
    # boundary, not after ten drags that may stop midway through large text.
    for attempt in range(limit + (10 if top else 0)):
        frame = scroll_query_frame(key)
        found = scroll_candidate(key, frame)
        if found is not None:
            return found
        direct = settings_scroll_direction(frame,key)
        if direct is not None:
            down = direct
        clipped = candidate(key, frame)
        if clipped is not None:
            _, sy1, _, sy2 = scroll_bounds(frame, key)
            _, y1, _, y2 = rect(clipped)
            if y2 >= sy2:
                down = False
            elif y1 <= sy1:
                down = True
        surface = vertical_scroll_surface(frame, key)
        signature = tuple(tuple(node.get(attr, '') for attr in
                          ('resource-id','class','text','content-desc','bounds'))
                          for node in surface.iter('node') if visible(node))
        stable = stable + 1 if signature == previous and down == previous_direction else 1
        if stable >= 3:
            if down and top:
                down, stable = False, 1
            else:
                break
        if OUT.exists():
            stem = 'scroll-query-' + str(len(SCROLL_PROOFS))
            (OUT / (stem+'.xml')).write_text(ET.tostring(frame, encoding='unicode'))
            print('SCROLL_QUERY ' + json.dumps({'target':key,'attempt':attempt,
                  'direction':'top' if down else 'bottom','stableOwnerFrames':stable,
                  'navigation':'observed-settings-order' if direct is not None else 'boundary-search',
                  'observation':stem+'.xml','surfaceBounds':rect(surface)}), flush=True)
        # A clipped song action is already located. A fast fling can jump
        # across its entire usable interval in the small font2 viewport and
        # alternate between opposite clipped edges. Approach it with the same
        # overlapping slow drag used for precise settings controls; retain all
        # whole-viewport and minimum-touch-area checks above.
        precise = (key.startswith(('settings-', 'tag-cleaner-', 'library-menu-item-'))
                   or (key.startswith('song-card-') and clipped is not None)
                   or key in ('Regeln ändern', 'V5 Acceptance · bereits sauber', 'Vorher: ' + CLEANER_TITLE))
        coordinates = vertical_swipe_coordinates(frame, key, down=down, precise=precise)
        SCROLL_PROOFS.append({'target': key, 'direction': 'top' if down else 'bottom',
                             'surfaceBounds': rect(vertical_scroll_surface(frame, key)),
                             'coordinates': coordinates})
        adb('shell', 'input', 'swipe', *(str(value) for value in coordinates), '800' if precise else '300')
        previous, previous_direction = signature, down
        time.sleep(.2)
    found = scroll_candidate(key, scroll_query_frame(key))
    if found is not None:
        return found
    raise AssertionError('Scrollable UI not reachable: ' + key)


def select(key, top=False):
    tap_node(scroll_to(key, top=top))
    time.sleep(.4)


def screenshot(name):
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
    (OUT / (name + '.xml')).write_text(dump_hierarchy(False))


def validate_library_header_touch_areas(frame):
    controls = [candidate(key,frame) for key in ('library-open-cleaner','library-toggle-search','library-open-menu')]
    for node in controls:
        assert node is not None and node.get('package') == PACKAGE and node.get('enabled') == 'true', 'Header control missing or not enabled app-owned UI'
        x1,y1,x2,y2 = rect(node)
        assert 0 <= x1 < x2 <= 480 and 0 <= y1 < y2 <= 960, 'Header control is clipped by screen'
        assert x2-x1 >= 72 and y2-y1 >= 72, 'Header control is smaller than 48dp'
    cleaner,search,menu = (rect(node) for node in controls)
    assert cleaner[2] <= search[0], 'Header cleaner overlaps search'
    assert search[2] <= menu[0], 'Header search overlaps menu'
    return {'cleanerBounds':cleaner,'searchBounds':search,'menuBounds':menu}


def validate_library_panel_background(frame, info_key, read_pixel):
    shell = candidate('library-tracks-shell', frame)
    mini = candidate('mini-player-viewport', frame)
    assert shell is not None and mini is not None, 'Library panel or mini-player missing'
    surface = vertical_scroll_surface(frame, info_key)
    assert all(n.get('package') == PACKAGE for n in (shell,mini,surface)), 'Panel geometry is not app-owned'
    parents = {child:parent for parent in frame.iter() for child in parent}
    # Fabric exposes the painted marker and ScrollView as native siblings.
    # Accept only that same immediate render owner or actual containment.
    assert surface in shell.iter('node') or parents.get(surface) is parents.get(shell), 'Song viewport has another native panel owner'
    sx1,sy1,sx2,sy2 = rect(shell)
    vx1,vy1,vx2,vy2 = rect(surface)
    mx1,my1,mx2,my2 = rect(mini)
    assert sx1 <= vx1 < vx2 <= sx2 and sy1 <= vy1 < vy2 <= sy2, 'Song viewport escapes panel'
    assert sx1 <= mx1 < mx2 <= sx2 and my2 <= sy2, 'Painted panel stops above/behind mini-player'
    gap = my1-vy2
    assert 28 <= gap <= 32, 'Library reserves bottom safe area twice or overlaps mini-player'
    samples=[]
    for x in (sx1+6,sx2-6):
        before=tuple(read_pixel((x,vy2-2)))[:3]
        after=tuple(read_pixel((x,vy2+2)))[:3]
        delta=max(abs(a-b) for a,b in zip(before,after))
        assert delta <= 3, 'Abrupt background band at lower list viewport edge'
        samples.append({'x':x,'above':before,'below':after,'maximumChannelStep':delta})
    return {'panelBounds':rect(shell),'listBounds':rect(surface),'miniPlayerBounds':rect(mini),
            'gapPixels':gap,'backgroundSamples':samples}


def inspect_library_panel_screenshot(frame, info_key, path):
    from PIL import Image
    with Image.open(path) as image:
        return validate_library_panel_background(frame, info_key, image.getpixel)


def validate_library_section_touch_areas(frame):
    section = candidate('library-section-header', frame)
    title = candidate('library-section-title', frame)
    assert section is not None and title is not None, 'Library section/title missing'
    assert section.get('package') == title.get('package') == PACKAGE, 'Section/title is not app-owned'
    sx1,sy1,sx2,sy2 = rect(section)
    areas = {'library-section-title': rect(title)}
    controls = {}
    for key in ('library-song-view-control','library-sort-control','library-shuffle-button','library-play-button'):
        node = candidate(key, frame)
        assert node is not None and node.get('package') == PACKAGE, 'Library control is missing or not app-owned: '+key
        assert node.get('enabled') == 'true', 'Library control is not enabled: '+key
        area = rect(node)
        assert area[2]-area[0] >= 72 and area[3]-area[1] >= 72, 'Library control is smaller than 48dp: '+key
        areas[key] = controls[key] = area
    for key,(x1,y1,x2,y2) in areas.items():
        assert 0 <= sx1 <= x1 < x2 <= sx2 <= 480 and 0 <= sy1 <= y1 < y2 <= sy2 <= 960, 'Library title/control is clipped: '+key
    entries = list(areas.items())
    for index,(left,a) in enumerate(entries):
        for right,b in entries[index+1:]:
            assert a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1], 'Library title/actions overlap: '+left+'/'+right
    return {'sectionBounds':rect(section),'titleBounds':rect(title),'controls':controls}


def soundcloud_info_nodes(frame):
    page = candidate('soundcloud-track-page-current', frame)
    assert page is not None, 'Current SoundCloud page missing'
    parents = {child: parent for parent in frame.iter('node') for child in parent}
    keys = ('soundcloud-track-metadata','soundcloud-track-info-chip','soundcloud-paused-controls')
    scope = page
    while scope is not None:
        groups = [[node for node in scope.iter('node') if matches(node,key) and visible(node)
                   and rect(node)[0] < rect(node)[2] and rect(node)[1] < rect(node)[3]] for key in keys]
        assert all(len(group) <= 1 for group in groups), 'Ambiguous visible SoundCloud controls'
        if all(len(group) == 1 for group in groups):
            return tuple(group[0] for group in groups)
        if matches(scope,'soundcloud-track-carousel-root'):
            break
        scope = parents.get(scope)
    raise AssertionError('SoundCloud metadata/info action missing from current native render owner')


def validate_soundcloud_info_chip(frame):
    # Fabric/native z-order can expose these views as siblings of the JS page
    # marker. Bind the smallest recorded native owner, never arbitrary UI nodes.
    metadata, chip, controls = soundcloud_info_nodes(frame)
    assert all(node.get('package') == PACKAGE for node in (metadata,chip,controls)), 'SoundCloud controls are not app-owned'
    assert chip.get('enabled') == 'true', 'SoundCloud info action is not enabled app-owned UI'
    assert chip.get('content-desc') == 'Infos zu diesem Track', 'SoundCloud info action label differs'
    mx1,my1,mx2,my2 = rect(metadata)
    x1,y1,x2,y2 = rect(chip)
    assert x2-x1 >= 72 and y2-y1 >= 72, 'SoundCloud info action smaller than 48dp'
    assert 0 <= mx1 <= x1 < x2 <= mx2 <= 480 and 0 <= my1 <= y1 < y2 <= my2 <= 960, 'SoundCloud info action clipped by metadata/screen'
    cx1,cy1,cx2,cy2 = rect(controls)
    assert 0 <= cx1 < cx2 <= 480 and my2 <= cy1 < cy2 <= 960, 'SoundCloud metadata overlaps transport controls'
    return {'metadataBounds':rect(metadata),'infoBounds':rect(chip),'transportBounds':rect(controls)}


def soundcloud_info_font_acceptance():
    settings()
    select('settings-player-layout-soundcloud', top=True)
    back()
    proofs = []
    for scale in ('1.0','1.3','1.5','2.0'):
        # Changing system font scale recreates the Activity and dismisses its
        # transient player route. Start from the proven Library state each time.
        adb('shell','settings','put','system','font_scale',scale)
        wait_uncovered_library_header()
        wait_selected_session(TITLES[0])
        tap('mini-player-open')
        hitbox = find('soundcloud-swipe-hitbox')
        if hitbox.get('content-desc') == 'Pausieren':
            tap_node(hitbox)
        find('soundcloud-play-button')
        find('soundcloud-track-info-chip')
        time.sleep(.6)
        first = validate_soundcloud_info_chip(tree(compressed=False))
        second = validate_soundcloud_info_chip(tree(compressed=False))
        assert first == second, 'SoundCloud info layout has not settled'
        screenshot('soundcloud-info-font-'+scale)
        tap('soundcloud-track-info-chip')
        find('track-info-hero')
        screenshot('soundcloud-info-open-font-'+scale)
        back()
        find('soundcloud-track-info-chip')
        back()
        wait_uncovered_library_header()
        proofs.append({'fontScale':scale,**second,'trackInfoOpened':True})
    adb('shell','settings','put','system','font_scale','1.0')
    settings()
    select('settings-player-layout-classic', top=True)
    back()
    V5_PROOFS['soundcloudInfoFonts'] = proofs
    CHECKS.append('soundcloud-info-chip-font-1.0-1.3-1.5-2.0-whole48dp-no-overlap-real-navigation')


def header_font_preflight():
    proofs = []
    for scale in ('1.0','2.0'):
        adb('shell','settings','put','system','font_scale',scale)
        wait_uncovered_library_header()
        proofs.append({'fontScale':scale,**validate_library_header_touch_areas(tree(compressed=False))})
        screenshot('header-font-preflight-'+scale)
    adb('shell','settings','put','system','font_scale','1.0')
    wait_uncovered_library_header()
    V5_PROOFS['headerPreflight'] = proofs
    CHECKS.append('public-library-header-font1-and-font2-whole48dp-controls-before-full-flow')


def settings():
    # A font-scale configuration change can still be replacing the native
    # window. Require the same uncovered stable-header ACK as cold start.
    header = wait_uncovered_library_header()
    tap_node(header)
    # Never treat the underlying song list as the unopened menu's scroller.
    menu_card = find('library-menu-card')
    assert menu_card.get('package') == PACKAGE, 'Opened settings menu is not app-owned'
    target = scroll_to('library-menu-item-einstellungen')
    assert target.get('package') == PACKAGE and target.get('enabled') == 'true', 'Settings action is not enabled app-owned UI'
    x1,y1,x2,y2 = rect(target)
    assert x2-x1 >= 72 and y2-y1 >= 72, 'Settings menu touch area is smaller than 48dp'
    tap_node(target)
    screen = find('settings-screen')
    if matches(screen, 'settings-screen'):
        prepare_settings_groups()


def prepare_settings_groups():
    global COMPACT_SETTINGS, SETTINGS_COLOR_TARGET
    COMPACT_SETTINGS = False
    SETTINGS_COLOR_TARGET = 'appAccent'
    screenshot('compact-settings-home')
    for group in ('appearance', 'player', 'motion', 'library'):
        select('settings-group-' + group, top=True)
    COMPACT_SETTINGS = True


def checkbox(key, checked):
    node = scroll_to(key, top=True)
    if node.get('checked') != str(checked).lower():
        tap_node(node)
    time.sleep(.7)
    assert find(key).get('checked') == str(checked).lower(), 'Switch did not retain requested state: ' + key


def library_tab(name):
    key = 'library-tab-' + name
    deadline = time.monotonic() + 30
    previous, stable, swipes = None, 0, 0
    while time.monotonic() < deadline:
        frame = tree()
        node = candidate(key, frame)
        area = candidate('library-tabs', frame)
        bounds = (rect(node), rect(area)) if node is not None and area is not None else None
        stable = stable + 1 if bounds is not None and bounds == previous else 0
        previous = bounds
        if node is not None and node.get('enabled') == 'true' and stable >= 2:
            assert node.get('package') == PACKAGE, 'Library tab does not belong to app'
            (OUT / ('tab-' + name + '-before.xml')).write_text(ET.tostring(frame, encoding='unicode'))
            if node.get('selected') != 'true':
                tap_node(node)
            confirmed = 0
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                after = tree()
                selected = candidate(key, after)
                confirmed = confirmed + 1 if selected is not None and selected.get('selected') == 'true' else 0
                if confirmed >= 2:
                    return
                time.sleep(.25)
            (OUT / ('tab-' + name + '-unconfirmed.xml')).write_text(ET.tostring(after, encoding='unicode'))
            raise AssertionError('Library tab selection was not acknowledged: ' + name)
        if node is None and area is not None:
            assert swipes < 12, 'Library tab not reachable: ' + name
            _, y1, _, y2 = rect(area)
            begin, finish = (420, 60) if swipes < 6 else (60, 420)
            adb('shell', 'input', 'swipe', str(begin), str((y1+y2)//2), str(finish), str((y1+y2)//2), '250')
            swipes += 1
            previous, stable = None, 0
        time.sleep(.25)
    raise AssertionError('Library tab never established stable enabled geometry: ' + name)


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


DOCUMENTS_PACKAGES = ('com.google.android.documentsui', 'com.android.documentsui')


class PickerRootClippedError(AssertionError):
    """A transient system window frame is not yet safe to touch."""


def document_nodes(root):
    return [node for node in root.iter('node') if node.get('package') in DOCUMENTS_PACKAGES and visible(node)]


def wait_document_picker(timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        root = tree(compressed=False)
        if document_nodes(root):
            return root
        time.sleep(.3)
    raise AssertionError('Actual system DocumentsUI picker did not arrive')


def storage_label(node):
    text = node.get('text', '')
    return text in ('Internal storage', 'Pixel 6') or text.startswith('sdk_gphone')


def picker_breadcrumbs(root):
    return [node for node in document_nodes(root)
            if node.get('resource-id', '').endswith(':id/breadcrumb_text')]


def picker_at_internal_root(root):
    crumbs = picker_breadcrumbs(root)
    return len(crumbs) == 1 and storage_label(crumbs[0]) and crumbs[0].get('enabled') == 'true'


def picker_root_touch(root):
    crumbs = picker_breadcrumbs(root)
    assert crumbs and storage_label(crumbs[0]), 'Exact system storage breadcrumb missing'
    parents = {child: parent for parent in root.iter() for child in parent}
    item = parents.get(crumbs[0])
    owner = parents.get(item)
    assert item is not None and item.get('package') in DOCUMENTS_PACKAGES and item.get('enabled') == 'true', 'Root breadcrumb item is not enabled or system-owned'
    assert owner is not None and owner.get('resource-id', '').endswith(':id/horizontal_breadcrumb'), 'Actual breadcrumb touch owner missing'
    x1,y1,x2,y2 = rect(item)
    ox1,oy1,ox2,oy2 = rect(owner)
    if not (ox1 <= x1 < x2 <= ox2 and oy1 <= y1 < y2 <= oy2):
        raise PickerRootClippedError('Root breadcrumb clipped by its native owner')
    return item, crumbs


def settle_picker_root(root, timeout=25):
    deadline = time.monotonic() + timeout
    previous, stable = None, 0
    last_clip = ''
    while time.monotonic() < deadline:
        if picker_at_internal_root(root):
            return None, root
        try:
            item, crumbs = picker_root_touch(root)
        except PickerRootClippedError as error:
            # DocumentsUI's enter animation can briefly offset a child from
            # its scrolling owner. Never tap that frame or enlarge its bounds.
            last_clip = str(error)
            previous, stable = None, 0
            time.sleep(.3)
            root = tree(compressed=False)
            continue
        fingerprint = ([node.get('text') for node in crumbs], rect(item))
        stable = stable + 1 if fingerprint == previous else 0
        previous = fingerprint
        if stable >= 2:
            return item, root
        time.sleep(.3)
        root = tree(compressed=False)
    raise AssertionError('Root breadcrumb never establishes stable touch geometry: ' + last_clip)


def navigate_picker_root(root, timeout=25):
    item, root = settle_picker_root(root, timeout)
    if item is None:
        return
    crumbs = picker_breadcrumbs(root)
    trail = [node.get('text') for node in crumbs]
    (OUT / 'picker-root-before-input.xml').write_text(ET.tostring(root, encoding='unicode'))
    (OUT / 'picker-root-input.json').write_text(json.dumps({'trail':trail,'bounds':rect(item)}, indent=2))
    tap_node(item)
    deadline = time.monotonic() + timeout
    stable = 0
    while time.monotonic() < deadline:
        after = tree(compressed=False)
        stable = stable + 1 if picker_at_internal_root(after) else 0
        if stable >= 3:
            (OUT / 'picker-internal-root-ack.xml').write_text(ET.tostring(after, encoding='unicode'))
            print('PICKER_ROOT_ACK ' + json.dumps({'before':trail,'after':[node.get('text') for node in picker_breadcrumbs(after)],'bounds':rect(item),'stableFrames':stable}), flush=True)
            return
        time.sleep(.3)
    raise AssertionError('System picker did not acknowledge internal-root breadcrumb navigation')


def select_picker_storage(timeout=25):
    root = wait_document_picker(timeout)
    if picker_at_internal_root(root):
        return
    if picker_breadcrumbs(root):
        navigate_picker_root(root, timeout)
        return
    nodes = document_nodes(root)
    opener = next((node for node in nodes if node.get('content-desc') in ('Show roots','Navigate up')
                   and node.get('enabled') == 'true'), None)
    assert opener is not None, 'System storage navigation action absent'
    tap_node(opener)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        root = tree(compressed=False)
        storage = [node for node in document_nodes(root) if storage_label(node)]
        if storage:
            assert len(storage) == 1, 'System internal-storage action ambiguous'
            tap_node(storage[0])
            return
        time.sleep(.3)
    raise AssertionError('Internal storage did not arrive in the actual system picker')


def choose_folder(parts):
    select_picker_storage()
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


def fixture_media_store_ready(raw):
    names = ('V3-0.mp3', 'V3-1.m4a', 'V3-2.flac', 'V3-3.mp3')
    for name, title in zip(names, TITLES):
        rows = [line for line in raw.splitlines()
                if re.search(r'_display_name=' + re.escape(name) + r'(?:,|$)', line)]
        if len(rows) != 1:
            return False
        row = rows[0]
        duration = re.search(r'\bduration=(\d+)(?:,|$)', row)
        if not duration or int(duration[1]) <= 0 or not re.search(r'\bis_music=1(?:,|$)', row):
            return False
        if not re.search(r'\btitle=' + re.escape(title) + r'(?:,|$)', row):
            return False
    return True


def wait_for_fixture_media_store(timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        raw = adb('shell', 'content', 'query', '--uri', 'content://media/external/audio/media',
                  '--projection', '_id:_display_name:title:duration:is_music').decode(errors='replace')
        (OUT / 'fixture-mediastore.txt').write_text(raw)
        if fixture_media_store_ready(raw):
            print('Four synthetic audio fixtures confirmed by read-only public MediaStore query.', flush=True)
            return
        time.sleep(1)
    raise AssertionError('Synthetic audio fixture MediaStore registration did not complete')


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
    # Native stacks retain enabled library nodes beneath the closing player.
    # Wait for the foreground route before deriving any song tap coordinates.
    wait_uncovered_library_header()
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


def return_format_player_to_library():
    back()
    logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'Runtime failure returning from format player'
    wait_uncovered_library_header()


def prepare_collection():
    import_public_collection()
    # A visible first row is not a terminal import ACK. Metadata batches can
    # reorder its coordinates before input reaches Android (recorded native XML).
    wait_collection_idle()
    for index, duration in enumerate(FORMAT_DURATIONS[:3]):
        play_title(TITLES[index])
        tap('mini-player-open')
        assert_duration(duration)
        find('controls-play-pause')
        assert_native_playback(TITLES[index], duration)
        screenshot('format-' + str(index))
        tap('controls-play-pause')
        return_format_player_to_library()
    CHECKS.append('MP3-M4A-FLAC-native-duration-and-playback')
    path = OUT / 'audio' / 'V3-SAF.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=22050',
                    '-t', '80', '-c:a', 'libmp3lame', '-metadata', 'title=V3 SAF', '-metadata', 'artist=V3 Proof', str(path)], check=True)
    adb('shell', 'mkdir', '-p', '/sdcard/Music/V3OnlySAF')
    adb('push', str(path), '/sdcard/Music/V3OnlySAF/V3-SAF.mp3')
    tap('library-open-menu')
    tap('library-menu-item-ordner-hinzuf-gen')
    choose_folder(['Music', 'V3OnlySAF'])
    wait_collection_idle()
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
    create_public_playlist('V3Backup')
    tap('Playlist V3Backup')
    tap('playlist-detail-add-button')
    add_public_playlist_songs(TITLES[:2])
    tap('playlist-detail-add-close')
    screenshot('02-playlist-before-backup')
    playlist_to_library_replacement('acceptance', 5)
    CHECKS.append('public-nonempty-queue-replacement-two-to-five-native-playing')
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


def native_position_clock(session, title, state):
    validate_selected_session(session, title)
    match = re.search(r'PlaybackState\s*\{state=' + state +
                      r'\(\d+\), position=(\d+),[^}]*speed=([0-9.]+), updated=(\d+)', session)
    assert match, 'Exact native position, speed and Android clock missing'
    position, speed, updated = float(match[1])/1000, float(match[2]), int(match[3])/1000
    assert speed == (1.0 if state == 'PLAYING' else 0.0), 'Native playback speed differs'
    return position, updated


def wait_paused_session(title, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        session = app_media_session()
        try:
            native_position_clock(session, title, 'PAUSED')
            return session
        except AssertionError:
            time.sleep(.4)
    raise AssertionError('Exact selected native session did not acknowledge pause')


def validate_resume_clock(before, resumed, paused, ui_position, title):
    start, started = native_position_clock(resumed, title, 'PLAYING')
    finish, stopped = native_position_clock(paused, title, 'PAUSED')
    # All playback timing comes from the same Android elapsedRealtime clock.
    # Freeze the public timeline before comparing it, so RPC transfer time cannot
    # turn an earlier UI frame into a false seek/progress regression.
    validate_resumed_position(before, start, 0)
    assert finish-start >= 2, 'Resumed native playback did not advance'
    validate_resumed_position(start, finish, stopped-started)
    assert abs(ui_position-finish) <= 3, 'Paused public timeline differs from native position'
    return {'savedSeconds': before, 'resumedSeconds': start, 'pausedSeconds': finish,
            'nativeElapsedSeconds': stopped-started, 'uiSeconds': ui_position}


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
    resumed = wait_playing_session(TITLES[3])
    tap('mini-player-open')
    time.sleep(4)
    tap('controls-play-pause')
    paused = wait_paused_session(TITLES[3])
    after = classic_position(1260)
    proof = validate_resume_clock(before, resumed, paused, after, TITLES[3])
    (OUT / 'resume-clock-proof.json').write_text(json.dumps(proof, indent=2))
    print('Resume Android clock proof: ' + json.dumps(proof), flush=True)
    screenshot('04-resume-applied')
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


def focus_public_input(key):
    deadline = time.monotonic() + 20
    previous, stable = None, 0
    while time.monotonic() < deadline:
        frame = tree()
        field = candidate(key, frame)
        bounds = rect(field) if field is not None and field.get('enabled') == 'true' else None
        stable = stable + 1 if bounds is not None and bounds == previous else 0
        if stable >= 2:
            break
        previous = bounds
        time.sleep(.25)
    else:
        raise AssertionError('Input geometry did not settle: ' + key)
    assert field.get('package') == PACKAGE, 'Input does not belong to app'
    (OUT / 'public-input-before.xml').write_text(ET.tostring(frame, encoding='unicode'))
    if field.get('focused') != 'true':
        tap_node(field)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        after = tree()
        focused = candidate(key, after)
        if focused is not None and focused.get('focused') == 'true':
            return focused
        time.sleep(.25)
    (OUT / 'public-input-unfocused.xml').write_text(ET.tostring(after, encoding='unicode'))
    raise AssertionError('Public input did not acknowledge focus: ' + key)


def reveal_public_input(key):
    frame = tree(compressed=False)
    if candidate(key, frame) is not None:
        return find(key)
    ime = [node for node in frame.iter('node')
           if node.get('resource-id') == 'android:id/input_method_nav_back'
           and node.get('package') in ('com.google.android.inputmethod.latin', 'com.android.inputmethod.latin')
           and node.get('enabled') == 'true' and visible(node)]
    assert len(ime) == 1, 'Obscured input has no unique public keyboard dismiss button'
    (OUT / 'public-input-keyboard-before.xml').write_text(ET.tostring(frame, encoding='unicode'))
    # Touch the IME's own dismiss button, never send Activity BACK.
    tap_node(ime[0])
    return find(key)


def create_public_playlist(name):
    focus_public_input('library-playlist-name-input')
    adb('shell', 'input', 'text', name)
    field = reveal_public_input('library-playlist-name-input')
    assert field.get('text') == name, 'Playlist name input did not retain the requested value'
    # PlaylistCreateForm exposes onSubmitEditing with returnKeyType=done.
    # BACK can finish the Activity when Android already hid its soft keyboard.
    assert field.get('focused') == 'true', 'Playlist input lost focus before Done'
    adb('shell', 'input', 'keyevent', '66')
    find('Playlist ' + name)


def add_public_playlist_songs(titles):
    for index, title in enumerate(titles):
        key = title + ' zur Playlist hinzufügen'
        scroll_to(key)
        previous, stable = None, 0
        deadline = time.monotonic() + 20
        samples = []
        while time.monotonic() < deadline:
            frame = tree()
            target = scroll_candidate(key, frame)
            surface = candidate('playlist-detail-add-list', frame)
            if target is not None and surface is None:
                frame = tree(compressed=False)
                target = scroll_candidate(key, frame)
                surface = candidate('playlist-detail-add-list', frame)
            bounds = (rect(target), rect(surface)) if target is not None and surface is not None else None
            if bounds is not None:
                (x1, y1, x2, y2), (sx1, sy1, sx2, sy2) = bounds
                if not (sx1 <= x1 and sy1 <= y1 and x2 <= sx2 and y2 <= sy2):
                    bounds = None
            samples.append(bounds)
            stable = stable + 1 if bounds is not None and bounds == previous else 0
            if stable >= 2:
                break
            previous = bounds
            time.sleep(.2)
        else:
            (OUT / f'playlist-add-{index}-geometry.json').write_text(json.dumps(samples))
            raise AssertionError('Playlist add button never established stable touch geometry: ' + title)
        assert target.get('package') == PACKAGE and target.get('enabled') == 'true', 'Playlist add action is not enabled or app-owned'
        (OUT / f'playlist-add-{index}-before.xml').write_text(ET.tostring(frame, encoding='unicode'))
        proof = {'title': title, 'actionId': target.get('resource-id'), 'stableBounds': bounds,
                 'geometrySamples': samples, 'ack': 'not-yet-confirmed'}
        PLAYLIST_ADD_PROOFS.append(proof)
        (OUT / 'playlist-add-proofs.json').write_text(json.dumps(PLAYLIST_ADD_PROOFS, indent=2))
        tap_node(target)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            after = tree()
            if not any(matches(node, key) for node in after.iter('node')):
                break
            time.sleep(.2)
        else:
            raise AssertionError('Playlist addition was not acknowledged: ' + title)
        proof['ack'] = 'candidate-removed'
        (OUT / 'playlist-add-proofs.json').write_text(json.dumps(PLAYLIST_ADD_PROOFS, indent=2))


def queue_replacement_probe():
    """Diagnostic only: reproduce a nonempty 2 -> 4 public queue replacement."""
    import_public_collection()
    library_tab('playlists')
    create_public_playlist('QueueProbe')
    tap('Playlist QueueProbe')
    tap('playlist-detail-add-button')
    add_public_playlist_songs((TITLES[0], TITLES[2]))
    tap('playlist-detail-add-close')
    for attempt in range(2):
        if attempt:
            library_tab('playlists')
            select('Playlist QueueProbe')
        playlist_to_library_replacement(f'probe-{attempt}', 4)
    (OUT / 'diagnostic-result.json').write_text(json.dumps({
        'mode': 'queue-replacement-probe', 'status': 'diagnostic-only',
        'sourceCommit': os.environ['REVIEWED_APK_SOURCE_COMMIT'],
        'harnessCommit': os.environ['GITHUB_SHA'], 'playbackProofs': PLAYBACK_PROOFS,
        'releaseAccepted': False,
    }, indent=2))


def playlist_to_library_replacement(prefix, library_size):
    """Public playlist selection must establish two items before replacement."""
    row = next((node for node in tree().iter('node') if
                    node.get('resource-id', '').split(':id/')[-1].startswith('playlist-detail-song-')
                    and node.get('content-desc', '').startswith(TITLES[0] + ' von V3 Proof abspielen.')), None)
    assert row is not None and visible(row), 'Public playlist target absent'
    tap_node(row)
    wait_playing_session(TITLES[0])
    find('controls-play-pause')
    assert_native_playback(TITLES[0], 90)
    tap('controls-play-pause')
    queue_probe_snapshot(prefix + '-paused-two', 2)
    back()
    back()
    library_tab('tracks')
    play_title(TITLES[1])
    queue_probe_snapshot(prefix + '-selected-library', library_size)
    tap('mini-player-open')
    assert_duration(120)
    assert_native_playback(TITLES[1], 120)
    queue_probe_snapshot(prefix + '-playing-library', library_size)
    tap('controls-play-pause')
    back()


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


def perform_public_cover_swipe(expected_title):
    deadline = time.monotonic() + 20
    previous, stable = None, 0
    while time.monotonic() < deadline:
        frame = tree()
        hitbox = candidate('soundcloud-swipe-hitbox', frame)
        closing_queue = candidate('soundcloud-queue-close', frame)
        bounds = rect(hitbox) if hitbox is not None and closing_queue is None else None
        stable = stable + 1 if bounds is not None and bounds == previous else 0
        if stable >= 2:
            break
        previous = bounds
        time.sleep(.25)
    else:
        raise AssertionError('Cover swipe geometry did not settle outside queue overlay')
    assert hitbox.get('package') == PACKAGE and hitbox.get('enabled') == 'true', 'Cover gesture is not app-owned or enabled'
    (OUT / 'cover-swipe-before.xml').write_text(ET.tostring(frame, encoding='unicode'))
    (OUT / 'cover-swipe-before-session.txt').write_text(app_media_session())
    coordinates = horizontal_swipe_coordinates(hitbox)
    (OUT / 'cover-swipe-input.json').write_text(json.dumps({'bounds':bounds,'coordinates':coordinates,'durationMs':600,'expectedNativeTitle':expected_title}, indent=2))
    adb('shell', 'input', 'swipe', *(str(value) for value in coordinates), '600')
    wait_playing_session(expected_title)


def cover_swipe_probe():
    import_public_collection()
    library_tab('playlists')
    create_public_playlist('SwipeProbe')
    tap('Playlist SwipeProbe')
    tap('playlist-detail-add-button')
    add_public_playlist_songs(TITLES[:2])
    tap('playlist-detail-add-close')
    back()
    library_tab('tracks')
    settings()
    select('settings-player-layout-soundcloud', top=True)
    back()
    library_tab('playlists')
    select('Playlist SwipeProbe')
    row = next((node for node in tree().iter('node') if
                node.get('resource-id', '').split(':id/')[-1].startswith('playlist-detail-song-')
                and node.get('content-desc', '').startswith(TITLES[1] + ' von V3 Proof abspielen.')), None)
    assert row is not None and visible(row), 'Diagnostic M4A playlist row missing'
    tap_node(row)
    wait_playing_session(TITLES[1])
    queue_probe_snapshot('cover-probe-two-before', 2)
    assert_native_playback(TITLES[1], 120, soundcloud_seconds)
    perform_public_cover_swipe(TITLES[0])
    assert_duration(90)
    assert_native_playback(TITLES[0], 90, soundcloud_seconds)
    queue_probe_snapshot('cover-probe-two-after', 2)
    (OUT / 'diagnostic-result.json').write_text(json.dumps({
        'mode':'cover-swipe-probe','status':'diagnostic-only','releaseAccepted':False,
        'sourceCommit':os.environ['REVIEWED_APK_SOURCE_COMMIT'],'harnessCommit':os.environ['GITHUB_SHA'],
        'playbackProofs':PLAYBACK_PROOFS}, indent=2))


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
    perform_public_cover_swipe(TITLES[0])
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
              ('WXXX', b'\x00\x00https://pro.beatport.com'),
              ('TXXX', b'\x00REPLAYGAIN_TRACK_GAIN\x00-7.50 dB'),
              ('TXXX', b'\x00REPLAYGAIN_TRACK_PEAK\x000.923456'), ('APIC', b'\x00image/png\x00\x03\x00' + image),
              ('XKIW', b'Unknown frame must survive V5')]
    body = b''.join(key.encode() + len(value).to_bytes(4, 'big') + b'\x00\x00' + value for key, value in values)
    path.write_bytes(b'ID3\x03\x00\x00' + synchsafe(len(body)) + body + path.read_bytes())
    return path


def validate_cleaner_write(before, after):
    original, original_audio = id3_frames(before)
    updated, updated_audio = id3_frames(after)
    assert before != after, 'Physical cleaner apply did not change the synthetic original'
    assert original_audio == updated_audio, 'Encoded audio bytes changed'
    for field in ('APIC', 'TPUB', 'WXXX', 'TXXX', 'XKIW'):
        assert original[field] == updated.get(field), 'Preserved frame changed: ' + field
    for field, expected in (('TIT2', 'V5 Cleaner'), ('TPE1', 'V5 Proof')):
        payloads = updated.get(field, [])
        assert len(payloads) == 1, 'Changed text frame missing or duplicated'
        encoding = {0: 'latin1', 1: 'utf-16', 2: 'utf-16-be', 3: 'utf-8'}.get(payloads[0][0])
        assert encoding is not None and payloads[0][1:].decode(encoding).rstrip('\x00') == expected, 'Unexpected cleaned text: ' + field
    return {'beforeSha256': hashlib.sha256(before).hexdigest(), 'afterSha256': hashlib.sha256(after).hexdigest(),
            'audioSha256': hashlib.sha256(original_audio).hexdigest(), 'preservedFrames': ['APIC', 'TPUB', 'WXXX', 'TXXX', 'XKIW'],
            'preservedFrameSha256': {field: [hashlib.sha256(body).hexdigest() for body in original[field]]
                                    for field in ('APIC', 'TPUB', 'WXXX', 'TXXX', 'XKIW')}}


def public_cold_start():
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    wait_uncovered_library_header()


def wait_uncovered_library_header(timeout=60):
    deadline = time.monotonic() + timeout
    previous, stable = None, 0
    while time.monotonic() < deadline:
        frame = tree(compressed=False)
        node = candidate('library-open-menu', frame)
        safe = (node is not None and node.get('package') == PACKAGE
                and node.get('enabled') == 'true' and visible(node)
                and candidate('playback-recovery-banner', frame) is None
                and candidate('now-playing-screen', frame) is None)
        bounds = rect(node) if safe else None
        stable = stable + 1 if bounds is not None and bounds == previous else 0
        previous = bounds
        if stable >= 2:
            (OUT / 'cold-start-uncovered-header.xml').write_text(ET.tostring(frame, encoding='unicode'))
            return node
        time.sleep(.25)
    raise AssertionError('Library header remains covered, disabled or unstable after startup')


def assert_radio_selected(root, key):
    node = candidate(key, root)
    assert node is not None and node.get('checked') == 'true', 'Radio choice not selected: ' + key


def settings_switch_probe():
    """Public native switch diagnosis only; never release acceptance."""
    settings()
    node = scroll_to('settings-instant-colors', top=True)
    assert node.get('package') == PACKAGE and node.get('checked') == 'false', 'Unexpected native instant-colors initial state'
    screenshot('instant-colors-before')
    checkbox('settings-instant-colors', True)
    screenshot('instant-colors-after')
    back()
    public_cold_start()
    settings()
    node = scroll_to('settings-instant-colors', top=True)
    assert node.get('checked') == 'true', 'Instant-colors switch did not persist'
    screenshot('instant-colors-cold')
    (OUT / 'diagnostic-result.json').write_text(json.dumps({
        'mode': 'settings-switch-probe', 'status': 'diagnostic-only', 'releaseAccepted': False,
        'sourceCommit': os.environ['REVIEWED_APK_SOURCE_COMMIT'], 'harnessCommit': os.environ['GITHUB_SHA'],
        'control': 'settings-instant-colors', 'initialChecked': False, 'coldChecked': True,
        'nativeBounds': rect(node)}, indent=2))


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
    scroll_to('tag-cleaner-analyze', top=True)


def wait_cleaner_preview_tools():
    find('tag-cleaner-apply',timeout=90)
    select('tag-cleaner-tools',top=True)
    scroll_to('tag-cleaner-select-safe',top=True)


def validate_cleaner_result(root, mode, entry_root=None):
    expected_status = 'Anzeige gespeichert' if mode == 'display' else 'Datei und Anzeige bestätigt'
    result_text = [node.get('text', '') for node in root.iter('node')]
    entry_text=[node.get('text','') for node in (entry_root if entry_root is not None else root).iter('node')]
    assert expected_status in entry_text, 'Cleaner did not confirm durable success'
    assert any(re.fullmatch(r'1 geprüft · \d+ unverändert · 1 geändert · 0 ausgelassen · 0 fehlgeschlagen · 0 offen / unterbrochen', text)
               for text in result_text), 'Cleaner result contains unresolved or failed operations'


def cleaner_apply_dialog(mode):
    select('tag-cleaner-apply', top=True)
    root = tree()
    expected = 'Nur Bibliotheksanzeige' if mode == 'display' else 'Originaldatei-Tags schreiben'
    assert any(expected in node.get('text', '') for node in root.iter('node')), 'Wrong cleaner apply confirmation'
    assert candidate('tag-cleaner-confirm-list', root) is not None, 'Exact change list absent'
    if mode == 'file':
        select('tag-cleaner-original-backup-ack', top=True)
        root = tree()
    button = candidate('tag-cleaner-confirm-apply', root)
    assert button is not None and button.get('enabled') == 'true', 'Exact cleaner apply action absent or disabled'
    tap_node(button)
    find('tag-cleaner-result', timeout=90)
    summary=tree()
    status='Anzeige gespeichert' if mode=='display' else 'Datei und Anzeige bestätigt'
    scroll_to(status,top=True)
    validate_cleaner_result(summary,mode,tree())


def validate_native_queue_size(session, title, size):
    validate_selected_session(session, title)
    count = re.search(r'queueTitle=[^\n]*, size=(\d+)', session)
    assert count and int(count[1]) == size, 'Actual native queue size differs from safe public playlist'


def wait_safe_native_playlist(title, size, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        session = app_media_session()
        try:
            validate_playing_session(session, title)
            validate_native_queue_size(session, title, size)
            return session
        except AssertionError:
            time.sleep(.3)
    raise AssertionError('Native playlist queue never confirms exact safe size and title')


def select_cleaner_safe_playback_queue():
    # Public playlist playback replaces the queue with two known other sources.
    # Pausing alone would leave an automatic-next candidate unsafe to write.
    backup = json.loads((OUT / 'exported-backup.json').read_text())
    expected_ids = backup['playlists'][0]['songIds']
    library_tab('playlists')
    select('Playlist V3Backup')
    tap('playlist-detail-song-' + expected_ids[0])
    wait_safe_native_playlist(TITLES[0], len(expected_ids))
    tap('soundcloud-open-queue')
    rows = [node for node in tree().iter('node')
            if node.get('resource-id', '').split(':id/')[-1].startswith('queue-row-')]
    actual_ids = [node.get('resource-id', '').split(':id/')[-1].removeprefix('queue-row-') for node in rows]
    assert actual_ids == expected_ids, 'Public playlist playback did not exclude the cleaner fixture from its queue'
    frame=tree(compressed=False)
    keys=['soundcloud-queue-shuffle','soundcloud-queue-repeat','soundcloud-queue-close']
    geometry=validate_targets(frame,keys,PACKAGE)
    for left,right in zip(keys,keys[1:]):validate_disjoint(geometry[left],geometry[right])
    row_geometry={}
    for song_id in expected_ids:
        play,drag='queue-long-press-drag-'+song_id,'queue-drag-handle-'+song_id
        targets=validate_targets(frame,[play,drag],PACKAGE)
        validate_disjoint(targets[play],targets[drag]);row_geometry.update(targets)
    proofs=V5_PROOFS.setdefault('cleanerSafeQueueGeometry',[])
    proofs.append({'fontScale':adb('shell','settings','get','system','font_scale').decode().strip(),'header':geometry,'rows':row_geometry})
    screenshot('cleaner-safe-native-queue-'+str(len(proofs)))
    tap('soundcloud-queue-close')
    tap('soundcloud-swipe-hitbox')
    find('soundcloud-play-button')
    session = wait_paused_session(TITLES[0])
    validate_native_queue_size(session, TITLES[0], len(expected_ids))
    screenshot('cleaner-safe-native-playlist-paused')
    back()
    back()
    library_tab('tracks')


def cleaner_acceptance():
    path = dirty_cleaner_fixture()
    original = path.read_bytes()
    sidecar = path.with_suffix('.lrc')
    sidecar.write_bytes(b'[00:00.00]Synthetic V5 sidecar must remain exact.\n')
    adb('shell', 'mkdir', '-p', '/sdcard/Music/V5OnlySAF')
    adb('push', str(sidecar), CLEANER_TARGET.removesuffix('.mp3') + '.lrc')
    adb('push', str(path), CLEANER_TARGET)
    tap('library-open-menu')
    tap('library-menu-item-ordner-hinzuf-gen')
    choose_folder(['Music', 'V5OnlySAF'])
    wait_collection_idle()
    quiesce_optional_preparation()
    # The following public long-press selection scrolls to the imported row;
    # import success does not require a fifth/sixth row to start onscreen.
    select_cleaner_safe_playback_queue()
    open_cleaner_from_song('V5 Cleaner', 'V5 Proof')
    select('tag-cleaner-analyze')
    wait_cleaner_preview_tools()
    screenshot('v5-cleaner-read-only-display-preview')
    pulled = OUT / 'audio' / 'V5-after-preview.mp3'
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'Analysis modified the original file'
    select('tag-cleaner-select-safe', top=True)
    cleaner_apply_dialog('display')
    screenshot('v5-cleaner-confirmed-display-result')
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'Display-only apply modified the original file'
    # Android recreates the activity when system font scale changes. Configure
    # font2 before the explicit cold start and public reentry, not on a live preview.
    adb('shell','settings','put','system','font_scale','2.0')
    public_cold_start()
    select_cleaner_safe_playback_queue()
    library_tab('tracks')
    scroll_to('V5 Cleaner von V5 Proof', top=True)
    open_cleaner_from_song('V5 Cleaner', 'V5 Proof')
    select('tag-cleaner-analyze')
    wait_cleaner_preview_tools()
    clean = scroll_to('V5 Acceptance · bereits sauber', top=True)
    assert clean.get('package') == PACKAGE, 'Display cleanup lost its acknowledged correction on cold start'
    assert scroll_to('tag-cleaner-apply', top=True).get('enabled') == 'false', 'Already clean display fields can be applied again'
    select('Regeln ändern', top=True)
    select('tag-cleaner-mode-file', top=True)
    select('tag-cleaner-analyze', top=True)
    wait_cleaner_preview_tools()
    raw = scroll_to('Vorher: ' + CLEANER_TITLE, top=True)
    assert raw.get('text') == 'Vorher: ' + CLEANER_TITLE and raw.get('package') == PACKAGE, 'File preview omitted original raw whitespace'
    screenshot('v5-cleaner-raw-file-preview')
    adb('pull', CLEANER_TARGET, str(pulled))
    assert pulled.read_bytes() == original, 'File-tag analysis modified the original'
    select('tag-cleaner-select-safe', top=True)
    validate_native_queue_size(app_media_session(), TITLES[0], 2)
    cleaner_apply_dialog('file')
    screenshot('v5-cleaner-confirmed-saf-file-result')
    adb('pull', CLEANER_TARGET, str(pulled))
    V5_PROOFS['cleaner'] = validate_cleaner_write(original, pulled.read_bytes())
    sidecar_after = OUT / 'audio' / 'V5-after-write.lrc'
    adb('pull', CLEANER_TARGET.removesuffix('.mp3') + '.lrc', str(sidecar_after))
    assert sidecar_after.read_bytes() == sidecar.read_bytes(), 'Cleaner changed the generated sidecar'
    V5_PROOFS['cleaner']['sidecarSha256'] = hashlib.sha256(sidecar.read_bytes()).hexdigest()
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(pulled)], check=True, capture_output=True)
    (OUT / 'v5-cleaner-independent-ffprobe.json').write_bytes(probe.stdout)
    assert abs(float(json.loads(probe.stdout)['format']['duration']) - 75) < .25, 'Cleaned synthetic audio duration changed'
    public_cold_start()
    adb('shell','settings','put','system','font_scale','1.0')
    wait_uncovered_library_header()
    library_tab('tracks')
    scroll_to('V5 Cleaner von V5 Proof', top=True)
    V5_PROOFS['cleaner'].update({'readOnlyPreviewExactBytes': True, 'displayApplyExactOriginalBytes': True, 'coldStartPersisted': True, 'fixture': 'generated synthetic SAF MP3, no user music'})
    settings()
    select('settings-tag-cleaner', top=True)
    find('tag-cleaner-home')
    select('tag-cleaner-open-selection', top=True)
    find('Welche Musik möchtest du aufräumen?')
    back()
    back()
    CHECKS.append('V5-settings-longpress-selection-raw-preview-display-ack-cold-start-real-SAF-write-audio-APIC-unknown-frames-preserved')


def cleaner_playlist_font_acceptance():
    backup=json.loads((OUT/'exported-backup.json').read_text())
    song_id=backup['playlists'][0]['songIds'][0]
    proofs=[]
    for appearance in ('dark','light'):
        settings()
        select('settings-appearance-'+appearance,top=True)
        checkbox('settings-quiet-profile',True)
        back()
        adb('shell','settings','put','system','font_scale','2.0')
        wait_uncovered_library_header()
        library_tab('playlists')
        select('Playlist V3Backup')
        remove='playlist-detail-remove-song-'+song_id
        handle='playlist-detail-drag-handle-'+song_id
        scroll_to(remove,top=True)
        geometry=validate_targets(tree(compressed=False),[remove,handle],PACKAGE)
        validate_disjoint(geometry[remove],geometry[handle])
        screenshot('cleaner-playlist-font2-'+appearance)
        back()
        library_tab('tracks')
        select('library-open-cleaner',top=True)
        select('tag-cleaner-last-result',top=True)
        find('tag-cleaner-result')
        scroll_to('tag-cleaner-result-export',top=True)
        result_geometry=validate_targets(tree(compressed=False),['tag-cleaner-result-export','tag-cleaner-new-selection'],PACKAGE)
        screenshot('cleaner-result-font2-'+appearance)
        select('tag-cleaner-new-selection',top=True)
        select('tag-cleaner-open-selection',top=True)
        select('tag-cleaner-entire-library',top=True)
        field_proofs={}
        for field in ('title','artist','albumArtist','album','year','genre','trackNumber','discNumber'):
            key='tag-cleaner-field-'+field
            scroll_to(key,top=True)
            field_proofs.update(validate_targets(tree(compressed=False),[key],PACKAGE))
        screenshot('cleaner-fields-font2-'+appearance)
        select('tag-cleaner-analyze',top=True)
        find('tag-cleaner-preview-list',timeout=120)
        scroll_to('tag-cleaner-tools',top=True)
        frame=tree(compressed=False)
        preview_geometry=validate_targets(frame,['tag-cleaner-tools','tag-cleaner-apply'],PACKAGE)
        validate_disjoint(preview_geometry['tag-cleaner-tools'],preview_geometry['tag-cleaner-apply'])
        viewport=rect(candidate('tag-cleaner-preview-list',frame))
        assert viewport[3]-viewport[1]>=72,'Completed cleaner process leaves no usable font2 preview viewport'
        screenshot('cleaner-preview-font2-'+appearance)
        back()
        proofs.append({'appearance':appearance,'fontScale':'2.0','playlist':geometry,'fields':field_proofs,'result':result_geometry,'preview':preview_geometry,'previewViewport':viewport})
        adb('shell','settings','put','system','font_scale','1.0')
        wait_uncovered_library_header()
    V5_PROOFS['cleanerPlaylistFont2']=proofs
    CHECKS.append('cleaner-playlist-dark-light-font2-native48dp-disjoint-actions')


def validate_matrix_coverage(cases):
    expected = {(scale, appearance, skin, density)
                for scale in ('1.0','1.3','2.0') for appearance in ('dark','light')
                for skin in ('graphite','minimal','neon-cover') for density in ('standard','compact')}
    actual = [(case['fontScale'],case['appearance'],case['skin'],case['density']) for case in cases]
    assert len(actual) == len(expected) and set(actual) == expected, 'Presentation matrix missing or duplicates cases'
    for case in cases:
        menu, play = case['menuBounds'], case['playBounds']
        assert menu[2]-menu[0] >= 72 and menu[3]-menu[1] >= 72, 'Matrix menu is smaller than 48dp'
        assert play[2] <= menu[0]+1, 'Matrix play area overlaps menu'


def validate_previous_matrix(data):
    assert data['sourceCommit'] == '70275c7a66aa9d24e5c2a33421388d93ad9a20d6'
    assert data['apkSha256'] == 'f1d587e8ddbd5d1bd7cfbb07ba9104a55d8d17bd94c372babaadbe1df6831807'
    pinned = {
        '956aa2411c67ba890369a686b6ffdb402070f99a': (38502985939, 'sha256:3c41fb19942e57dea9df9ee954ba8f68fccf9d6fd577794bc291eeacbe1e1c05'),
        'e65cf4ce3d87a7ad310facf43a27c7d076782557': (38505950487, 'sha256:749abd2df08334fde929a62f13ce04c075565a6955d03d5cc2291ce88814cbe1'),
    }
    assert data['harnessCommit'] in pinned, 'Unreviewed previous matrix harness'
    assert (data['run'],data['artifactDigest']) == pinned[data['harnessCommit']], 'Previous matrix artifact identity mismatch'
    cases = data['cases']
    expected = {(scale,appearance,skin,density) for scale in ('1.0','1.3')
                for appearance in ('dark','light') for skin in ('graphite','minimal','neon-cover')
                for density in ('standard','compact')}
    actual = [(c['fontScale'],c['appearance'],c['skin'],c['density']) for c in cases]
    if data['harnessCommit'] == 'e65cf4ce3d87a7ad310facf43a27c7d076782557':
        expected |= {('2.0','dark','graphite',density) for density in ('standard','compact')}
    assert len(actual) == len(expected) and set(actual) == expected, 'Previous matrix coverage is incomplete or duplicated'
    for case in cases:
        menu,play = case['menuBounds'],case['playBounds']
        assert menu[2]-menu[0] >= 72 and menu[3]-menu[1] >= 72, 'Previous menu touch area fails 48dp'
        assert play[2] <= menu[0]+1, 'Previous play area overlaps menu'
    return cases


def previous_matrix_cases():
    if not os.environ.get('PREVIOUS_MATRIX_EVIDENCE'):
        return []
    root = Path(os.environ['PREVIOUS_MATRIX_EVIDENCE'])
    data = json.loads((root / 'verified-matrix-origin.json').read_text())
    cases = validate_previous_matrix(data)
    for case in cases:
        suffix = '-'.join(case[k] for k in ('fontScale','appearance','skin','density'))
        for surface in ('settings','library','player'):
            for extension in ('.png','.xml'):
                name = surface+'-'+suffix+extension
                matches = list(root.rglob(name))
                assert len(matches) == 1 and matches[0].stat().st_size > 0, 'Missing previous native matrix observation: '+name
                (OUT/name).write_bytes(matches[0].read_bytes())
    V5_PROOFS['matrixEvidenceOrigins'] = [data]
    return list(cases)


def pause_matrix_player(title):
    # While playing the public artwork hitbox replaces the paused controls.
    # The recorded native XML exposes its exact Pausieren action; wait for the
    # unchanged native pause ACK before requiring the visible paused controls.
    hitbox = find('soundcloud-swipe-hitbox')
    assert hitbox.get('package') == PACKAGE and hitbox.get('enabled') == 'true' and hitbox.get('content-desc') == 'Pausieren', 'Expected exact enabled app-owned public pause action'
    tap_node(hitbox)
    wait_paused_session(title)
    find('soundcloud-play-button')


def validate_font2_matrix_coverage(cases):
    expected = {('2.0',appearance,skin,density) for appearance in ('dark','light')
                for skin in ('graphite','minimal','neon-cover') for density in ('standard','compact')}
    actual = [(c['fontScale'],c['appearance'],c['skin'],c['density']) for c in cases]
    assert len(actual) == 12 and set(actual) == expected, 'Font2 regression matrix missing or duplicates cases'
    assert all(c['sectionPlayback']['title'] == TITLES[2] and c['sectionPlayback']['nativeState'] == 3 for c in cases), 'Font2 library play action not acknowledged'


def song_info_cases(mode):
    single = {('2.0','dark','graphite','compact')}
    if mode == 'song-info-single':
        return single
    assert mode == 'song-info-remaining', 'Unsupported song-info continuation scope'
    return {('2.0',a,s,d) for a in ('dark','light') for s in ('graphite','minimal','neon-cover')
            for d in ('standard','compact')} - single - {('2.0','dark','graphite','standard')}


def ui_matrix(font2_only=False, selected_cases=None):
    assert selected_cases is None or selected_cases in (song_info_cases('song-info-single'),song_info_cases('song-info-remaining')), 'Unsupported targeted matrix selection'
    V5_PROOFS['matrix'] = [] if selected_cases is not None else previous_matrix_cases()
    assert not font2_only or not V5_PROOFS['matrix'], 'Targeted new-APK regression cannot reuse earlier cases'
    completed = {(c['fontScale'],c['appearance'],c['skin'],c['density']) for c in V5_PROOFS['matrix']}
    for scale in (('2.0',) if font2_only else ('1.0', '1.3', '2.0')):
        if selected_cases is not None and not any(c[0] == scale for c in selected_cases):
            continue
        if all((scale,a,s,d) in completed for a in ('dark','light') for s in ('graphite','minimal','neon-cover') for d in ('standard','compact')):
            continue
        adb('shell', 'settings', 'put', 'system', 'font_scale', scale)
        for appearance in ('dark', 'light'):
            for skin in ('graphite', 'minimal', 'neon-cover'):
                if selected_cases is not None and not any(c[:3] == (scale,appearance,skin) for c in selected_cases):
                    continue
                if all((scale,appearance,skin,density) in completed for density in ('standard','compact')):
                    continue
                settings()
                select('settings-appearance-' + appearance, top=True)
                select('settings-skin-' + skin, top=True)
                checkbox('settings-quiet-profile', True)
                select('settings-waveform-accent-blue', top=True)
                for density in ('standard', 'compact'):
                    if selected_cases is not None and (scale,appearance,skin,density) not in selected_cases:
                        continue
                    select('settings-density-' + density, top=True)
                    screenshot(f'settings-{scale}-{appearance}-{skin}-{density}')
                    back()
                    first = scroll_to(TITLES[0] + ' von V3 Proof', top=True)
                    assert visible(first), 'Long German title cannot be selected'
                    identifier = first.get('resource-id', '').split(':id/')[-1]
                    assert identifier.startswith('song-card-'), 'Song action has no stable public UI identity'
                    menu = scroll_to(identifier.replace('song-card-', 'song-card-info-', 1))
                    first = find(identifier)
                    assert scroll_candidate(identifier, tree()) is not None, 'Play target is clipped after revealing its menu'
                    play_box, menu_box = rect(first), rect(menu)
                    assert menu_box[2]-menu_box[0] >= 72 and menu_box[3]-menu_box[1] >= 72, 'Song menu is smaller than 48dp'
                    assert play_box[2] <= menu_box[0]+1, 'Song play area overlaps its menu'
                    header = validate_library_header_touch_areas(tree(compressed=False))
                    section = validate_library_section_touch_areas(tree(compressed=False))
                    screenshot(f'library-{scale}-{appearance}-{skin}-{density}')
                    panel = inspect_library_panel_screenshot(tree(compressed=False),
                        identifier.replace('song-card-', 'song-card-info-', 1),
                        OUT / f'library-{scale}-{appearance}-{skin}-{density}.png')
                    tap_node(menu)
                    find('song-action-menu-card')
                    back()
                    tap('library-play-button')
                    session = wait_playing_session(TITLES[2])
                    stem = f'{scale}-{appearance}-{skin}-{density}'
                    (OUT / ('section-playback-'+stem+'.txt')).write_text(session)
                    tap('mini-player-open')
                    pause_matrix_player(TITLES[2])
                    screenshot(f'player-{scale}-{appearance}-{skin}-{density}')
                    V5_PROOFS['matrix'].append({'fontScale': scale, 'appearance': appearance,
                        'skin': skin, 'density': density, 'playBounds': play_box, 'menuBounds': menu_box,
                        'header':header,'section':section,'panelBackground':panel,
                        'sectionPlayback':{'title':TITLES[2],'nativeState':3}})
                    (OUT / 'matrix-progress.json').write_text(json.dumps(V5_PROOFS['matrix'], indent=2))
                    back()
                    if density == 'standard':
                        settings()
    if selected_cases is not None:
        actual = [(c['fontScale'],c['appearance'],c['skin'],c['density']) for c in V5_PROOFS['matrix']]
        assert len(actual) == len(selected_cases) and set(actual) == selected_cases, 'Targeted case coverage missing or duplicated'
        CHECKS.append('targeted-font2-selected-cases-whole48dp-native-play-ack')
    elif font2_only:
        validate_font2_matrix_coverage(V5_PROOFS['matrix'])
        CHECKS.append('targeted-12-font2-library-section-whole48dp-no-overlap-native-play-ack')
    else:
        validate_matrix_coverage(V5_PROOFS['matrix'])
        CHECKS.append('320dp-font-1.0-1.3-2.0-all-six-themes-standard-compact-48dp-menu-quiet-blue')
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0')


def quiesce_optional_preparation(timeout=60):
    frame = tree(compressed=False)
    panel = candidate('library-waveform-preparation', frame)
    if panel is None:
        return
    cancel = candidate('Waveformanalyse abbrechen', frame)
    assert cancel is not None and cancel.get('package') == PACKAGE and cancel.get('enabled') == 'true', 'Optional preparation has no valid public cancellation action'
    sequence = len(V5_PROOFS.setdefault('optionalPreparation', [])) + 1
    screenshot(f'optional-preparation-{sequence}-before-cancel')
    tap_node(cancel)
    deadline = time.monotonic() + timeout
    stable = 0
    while time.monotonic() < deadline:
        frame = tree(compressed=False)
        stopped = candidate('Waveformanalyse angehalten', frame) is not None
        completed = candidate('library-waveform-preparation', frame) is None
        stable = stable + 1 if stopped or completed else 0
        if stable >= 3:
            screenshot(f'optional-preparation-{sequence}-cancel-ack')
            V5_PROOFS['optionalPreparation'].append({'sequence': sequence, 'publicCancelBounds': rect(cancel),
                'terminalState': 'cancelled' if stopped else 'completed', 'stableAckFrames': stable})
            CHECKS.append('public-optional-waveform-cancellation-ack-before-maintenance')
            # Only after the actual coroutine publishes its terminal state and
            # releases metadata activity in finally, restart to prove durable
            # scan contents and remove the acknowledged optional UI session.
            public_cold_start()
            return
        time.sleep(.4)
    (OUT / 'optional-preparation-not-stopped.xml').write_text(ET.tostring(frame, encoding='unicode'))
    raise AssertionError('Optional waveform preparation did not acknowledge cancellation')


def wait_collection_idle(timeout=150):
    started = time.monotonic()
    deadline = started + timeout
    stable, details = 0, False
    while time.monotonic() < deadline:
        frame = tree(compressed=False)
        busy = candidate('library-import-status', frame)
        header = candidate('library-open-menu', frame)
        idle = (busy is None and header is not None and header.get('package') == PACKAGE
                and header.get('enabled') == 'true')
        stable = stable + 1 if idle else 0
        if stable >= 3:
            (OUT / 'collection-idle.xml').write_text(ET.tostring(frame, encoding='unicode'))
            print('Public scan status disappeared; collection ready for backup.', flush=True)
            return
        if not details and busy is not None and time.monotonic()-started >= 10:
            button = candidate('Scan-Details', frame)
            if button is not None:
                assert button.get('package') == PACKAGE and button.get('enabled') == 'true', 'Scan details control invalid'
                tap_node(button)
                details = True
                screenshot('scan-wait-details')
        time.sleep(.4)
    (OUT / 'collection-still-busy.xml').write_text(ET.tostring(frame, encoding='unicode'))
    raise AssertionError('Collection scan or persistence status did not finish before backup')


def prepare_final_stage_collection():
    # Create setup through actual public UI and SAF export, never inject app data.
    import_public_collection()
    wait_collection_idle()
    quiesce_optional_preparation()
    library_tab('playlists')
    create_public_playlist('V3Backup')
    tap('Playlist V3Backup')
    tap('playlist-detail-add-button')
    add_public_playlist_songs(TITLES[:2])
    tap('playlist-detail-add-close')
    back()
    library_tab('tracks')
    play_title(TITLES[0])
    tap('mini-player-open')
    tap('Titel favorisieren')
    tap('controls-play-pause')
    back()
    settings()
    select('settings-player-layout-soundcloud', top=True)
    back()


def final_stage_acceptance(cleaner_only=False):
    wait_uncovered_library_header()
    prepare_final_stage_collection()
    stages = (('SAF backup export, inspection and restore', backup_acceptance),
                          ('V5 independent accents and persistence', accent_acceptance),
                          ('V5 cleaner synthetic SAF transaction', cleaner_acceptance),
                          ('Cleaner and playlist font2 geometry', cleaner_playlist_font_acceptance),
                          ('font, theme and density matrix', ui_matrix))
    for label, action in stages:
        if cleaner_only and action is accent_acceptance:
            continue
        print('Stage: ' + label, flush=True)
        action()
        (OUT / 'stage-progress.json').write_text(json.dumps({
            'sourceCommit': os.environ['REVIEWED_APK_SOURCE_COMMIT'],
            'harnessCommit': os.environ['GITHUB_SHA'], 'lastCompletedStage': label,
            'checks': CHECKS, 'v5Proofs': V5_PROOFS, 'releaseAccepted': False}, indent=2))
    logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'App runtime failure'
    (OUT / 'stage-result.json').write_text(json.dumps({
        'mode': 'v5-cleaner-matrix' if cleaner_only else 'v5-final-stages', 'status': 'stage-only-passed', 'releaseAccepted': False,
        'sourceCommit': os.environ['REVIEWED_APK_SOURCE_COMMIT'],
        'harnessCommit': os.environ['GITHUB_SHA'],
        'apkSha256': os.environ['EXPECTED_APK_SHA256'],
        'checks': CHECKS, 'v5Proofs': V5_PROOFS, 'uiSnapshots': UI_SNAPSHOTS,
        'transportRecoveries': TRANSPORT_RECOVERIES}, indent=2))
    print('Remaining V5 stages passed; combine with exact-APK prefix proof before release acceptance.', flush=True)


def matrix_only_acceptance(font2_only=False, single_case=False, remaining_cases=False):
    wait_uncovered_library_header()
    prepare_final_stage_collection()
    settings()
    for field, color in (('appAccent','purple'),('playerAccent','cyan'),('waveform-accent','blue')):
        select(f'settings-{field}-{color}', top=True)
        assert_radio_selected(tree(), f'settings-{field}-{color}')
    checkbox('settings-instant-colors', True)
    back()
    print('Stage: font, theme and density matrix', flush=True)
    assert not (single_case and remaining_cases), 'Ambiguous targeted execution'
    mode = 'song-info-single' if single_case else 'song-info-remaining' if remaining_cases else None
    ui_matrix(font2_only=font2_only, selected_cases=song_info_cases(mode) if mode else None)
    logs = adb('logcat','-d','-v','threadtime').decode(errors='replace')
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'App runtime failure'
    (OUT / 'stage-result.json').write_text(json.dumps({
        'mode':mode if mode else 'v5-section-font2' if font2_only else 'v5-matrix','status':'stage-only-passed','releaseAccepted':False,
        'sourceCommit':os.environ.get('REVIEWED_APK_SOURCE_COMMIT',os.environ['GITHUB_SHA']),'harnessCommit':os.environ['GITHUB_SHA'],
        'apkSha256':Path('preview-input/apk-sha256.txt').read_text().split()[0],'checks':CHECKS,'v5Proofs':V5_PROOFS,
        'uiSnapshots':UI_SNAPSHOTS,'transportRecoveries':TRANSPORT_RECOVERIES},indent=2))


def main():
    global DEVICE, DEVICE_SERIAL, DEVICE_BOOT_ID
    apk = Path('preview-input/musik-player-preview.apk')
    sha = (Path('preview-input') / 'apk-sha256.txt').read_text().split()[0]
    commit = os.environ.get('REVIEWED_APK_SOURCE_COMMIT', os.environ['GITHUB_SHA'])
    if 'EXPECTED_APK_SHA256' in os.environ:
        assert sha == os.environ['EXPECTED_APK_SHA256'], 'Inspected artifact digest is not the pinned digest'
    validate_target(apk, sha, commit, Path('preview-input/source-commit.txt').read_text(), adb('shell', 'getprop', 'ro.kernel.qemu').decode())
    import uiautomator2
    OUT.mkdir(parents=True, exist_ok=True)
    DEVICE_SERIAL = adb('get-serialno').decode().strip()
    DEVICE_BOOT_ID = adb('shell', 'cat', '/proc/sys/kernel/random/boot_id').decode().strip()
    assert DEVICE_BOOT_ID, 'Missing emulator boot identity'
    DEVICE = uiautomator2.connect(DEVICE_SERIAL)
    generated_audio()
    wait_for_fixture_media_store()
    adb('install', '-r', str(apk), timeout=180)
    adb('shell', 'pm', 'grant', PACKAGE, 'android.permission.READ_MEDIA_AUDIO')
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')
    try:
        find('library-open-menu', timeout=90)
        header_font_preflight()
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'song-info-remaining':
            matrix_only_acceptance(remaining_cases=True)
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'song-info-single':
            matrix_only_acceptance(single_case=True)
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'v5-section-font2':
            matrix_only_acceptance(font2_only=True)
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'v5-matrix':
            matrix_only_acceptance()
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'v5-cleaner-matrix':
            final_stage_acceptance(cleaner_only=True)
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'v5-final-stages':
            final_stage_acceptance()
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'settings-switch-probe':
            print('Diagnostic only: public native instant-colors switch and cold persistence.', flush=True)
            settings_switch_probe()
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'cover-swipe-probe':
            print('Diagnostic only: two-track public cover swipe; no release acceptance.', flush=True)
            cover_swipe_probe()
            return
        if os.environ.get('APK_DIAGNOSTIC_MODE') == 'queue-replacement-probe':
            print('Diagnostic only: public two-to-four queue replacement; no release acceptance.', flush=True)
            queue_replacement_probe()
            return
        print('Stage: public scan, formats and collection', flush=True)
        prepare_collection()
        print('Stage: targeted responsive SoundCloud info action and real navigation', flush=True)
        soundcloud_info_font_acceptance()
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
        print('Stage: Cleaner and playlist font2 geometry', flush=True)
        cleaner_playlist_font_acceptance()
        print('Stage: font, theme and density matrix', flush=True)
        ui_matrix()
        logs = adb('logcat', '-d', '-v', 'threadtime').decode(errors='replace')
        assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|Expected .onGestureHandlerEvent.|ANR in '+re.escape(PACKAGE), logs), 'App runtime failure'
        result = {'status': 'passed', 'commit': commit, 'harnessCommit': os.environ['GITHUB_SHA'], 'apkSha256': sha, 'checks': CHECKS,
                  'playbackProofs': PLAYBACK_PROOFS, 'scrollProofs': SCROLL_PROOFS,
                  'pixelLauncherDialogs': LAUNCHER_DIALOGS, 'v5Proofs': V5_PROOFS, 'uiSnapshots': UI_SNAPSHOTS,
                  'transportRecoveries': TRANSPORT_RECOVERIES, 'playlistAdds': PLAYLIST_ADD_PROOFS,
                  'device': 'isolated API 35 x86_64 emulator, 480x960 pixels / density 240 = 320dp',
                  'limits': ['No A50 baseline performance comparison', 'No actual spoken TalkBack verification',
                             'Provider faults and restore journal interruptions covered separately by host/native tests']}
        (OUT / 'result.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result), flush=True)
    finally:
        from androidSmokeDiagnostics import collect_diagnostics, capture_final_snapshot
        collect_diagnostics(OUT, PACKAGE)
        capture_final_snapshot(lambda: screenshot('final'))
        capture_final_snapshot(lambda: (OUT / 'meminfo.txt').write_bytes(adb('shell', 'dumpsys', 'meminfo', PACKAGE, check=False)))
        capture_final_snapshot(lambda: (OUT / 'gfxinfo.txt').write_bytes(adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'framestats', check=False)))


if __name__ == '__main__':
    main()
