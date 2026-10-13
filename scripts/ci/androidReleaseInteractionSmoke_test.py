import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import androidReleaseInteractionSmoke as smoke
from androidReleaseInteractionSmoke import (validate_target, rect, matches,
    validate_retest_provenance, import_confirmation_button, pixel_launcher_close_button, app_time_values, FORMAT_DURATIONS,
    time_seconds, timeline_values, validate_playing_session, horizontal_swipe_coordinates, assert_native_playback)
import xml.etree.ElementTree as ET

class ReleaseAcceptanceSafetyTest(unittest.TestCase):
    def test_refuses_physical_devices_and_wrong_artifact_source_or_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'preview.apk'
            apk.write_bytes(b'fixture')
            sha = hashlib.sha256(b'fixture').hexdigest()
            commit = 'a' * 40
            validate_target(apk, sha, commit, commit, '1\n')
            for emulator, source, checksum in [('0', commit, sha), ('', commit, sha),
                                               ('1', 'b' * 40, sha), ('1', commit, '0' * 64)]:
                with self.assertRaises(AssertionError):
                    validate_target(apk, checksum, commit, source, emulator)
            with self.assertRaises(AssertionError):
                validate_target(apk, sha, 'codex', 'codex', '1')

    def test_requires_a_real_touch_rectangle_and_exact_identifiers(self):
        node = ET.fromstring('<node bounds="[12,20][84,92]" resource-id="app:id/backup-create"/>')
        self.assertEqual(rect(node), [12, 20, 84, 92])
        self.assertTrue(matches(node, 'backup-create'))
        self.assertFalse(matches(node, 'backup'))
        with self.assertRaises(AssertionError):
            rect(ET.fromstring('<node bounds="[0,0][0,0]"/>'))

    def source_jobs(self):
        return [{'name':name,'head_sha':'a'*40,'status':'completed','conclusion':'success'}
                for name in ('Dependency security audit',
                             'Typecheck, tests, coverage, lint, config gates',
                             'Android native build and tests')]

    def test_retest_allows_only_test_documentation_changes(self):
        jobs = self.source_jobs()
        validate_retest_provenance('a'*40, ['scripts/ci/androidReleaseInteractionSmoke.py'], jobs)
        validate_retest_provenance('a'*40, ['docs/CODEX-V5-CHECKPOINTS.md'], jobs)
        for path in ('App.tsx','package-lock.json','modules/expo-system-audio/android/build.gradle',
                     '.github/workflows/ci.yml', 'docs/unreviewed-script.py'):
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [path], jobs)

    def test_retest_rejects_failed_pending_missing_duplicate_or_other_source_gates(self):
        for field, value in [('conclusion','failure'),('status','in_progress'),('head_sha','b'*40)]:
            jobs = self.source_jobs()
            jobs[2][field] = value
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [], jobs)
        for jobs in (self.source_jobs()[:2], self.source_jobs()+[self.source_jobs()[0]]):
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [], jobs)

    def test_import_confirmation_matches_the_observed_public_dialog(self):
        root = ET.fromstring('<hierarchy><node text="Musik importieren"/>'
                             '<node resource-id="android:id/button1" text="IMPORTIEREN" bounds="[267,542][438,614]"/></hierarchy>')
        self.assertEqual(rect(import_confirmation_button(root)), [267,542,438,614])

    def test_never_confirms_an_unrelated_dialog_or_button(self):
        for title, action in [('Backup gespeichert','IMPORTIEREN'),('Musik importieren','LÖSCHEN')]:
            root = ET.fromstring(f'<hierarchy><node text="{title}"/>'
                                  f'<node resource-id="android:id/button1" text="{action}"/></hierarchy>')
            with self.assertRaises(AssertionError):
                import_confirmation_button(root)

    def test_format_fixtures_exceed_the_enabled_music_filter(self):
        self.assertTrue(all(duration > 45 for duration in FORMAT_DURATIONS))

    def test_closes_only_the_identified_pixel_launcher_system_dialog(self):
        root = ET.fromstring('<hierarchy><node resource-id="android:id/alertTitle" text="Pixel Launcher isn\'t responding"/>'
                             '<node resource-id="android:id/aerr_close" text="Close app"/></hierarchy>')
        self.assertIsNotNone(pixel_launcher_close_button(root))
        for title in ("k1w1-Musik isn't responding", "System UI isn't responding", 'Musik importieren'):
            root = ET.fromstring(f'<hierarchy><node resource-id="android:id/alertTitle" text="{title}"/>'
                                  '<node resource-id="android:id/aerr_close" text="Close app"/></hierarchy>')
            self.assertIsNone(pixel_launcher_close_button(root))

    def test_decoded_time_excludes_system_clock_and_song_metadata_labels(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="10:34"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:42"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:29"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:30 • MP3 • 32 kbps"/></hierarchy>')
        self.assertEqual(app_time_values(root), [42,89])

    def test_time_parser_matches_native_hours_and_rejects_invalid_components(self):
        self.assertEqual(time_seconds('1:01:01'), 3661)
        self.assertEqual(time_seconds('21:00'), 1260)
        self.assertEqual(time_seconds('0:00'), 0)
        for label in ('1:60', '1:60:00', '90 seconds', '1:30 • MP3', '-1:01'):
            with self.assertRaises(AssertionError):
                time_seconds(label)

    def test_classic_timeline_reads_slider_sibling_times_and_ignores_background(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="1:30"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:01"/>'
                             '<node><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[21,548][459,635]"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:42"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:29"/></node></hierarchy>')
        self.assertEqual(timeline_values(root), (42,89))

    def test_soundcloud_total_is_not_confused_with_elapsed_or_system_clock(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="1:30"/>'
                             '<node package="com.k1w1a0style.musikplayer" resource-id="soundcloud-waveform-current-time" text="1:30" bounds="[0,0][50,30]"/>'
                             '<node package="com.k1w1a0style.musikplayer" resource-id="soundcloud-waveform-total-time" text="2:00" bounds="[300,0][350,30]"/></hierarchy>')
        self.assertEqual(timeline_values(root), (90,120))
        with patch.object(smoke, 'tree', return_value=root), patch.object(smoke.time, 'monotonic', side_effect=[0,0,26]), patch.object(smoke.time, 'sleep'):
            with self.assertRaises(AssertionError):
                smoke.assert_duration(90)

    def test_one_time_label_or_ambiguous_player_times_cannot_prove_a_timeline(self):
        for values in ('<node package="com.k1w1a0style.musikplayer" text="1:30"/>',
                       '<node package="com.k1w1a0style.musikplayer" text="0:00"/><node package="com.k1w1a0style.musikplayer" text="1:30"/><node package="com.k1w1a0style.musikplayer" text="2:00"/>'):
            root = ET.fromstring('<hierarchy><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[0,0][50,30]"/>' + values + '</hierarchy>')
            with self.assertRaises(AssertionError):
                timeline_values(root)

    def test_duration_codec_tolerance_is_bounded_to_one_second(self):
        for duration in (88,89,90,91,92):
            root = ET.fromstring('<hierarchy><node><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[0,0][50,30]"/>'
                                 '<node package="com.k1w1a0style.musikplayer" text="0:04"/>'
                                 f'<node package="com.k1w1a0style.musikplayer" text="1:{duration-60:02}"/></node></hierarchy>')
            with patch.object(smoke, 'tree', return_value=root), patch.object(smoke.time, 'monotonic', side_effect=[0,0,26]), patch.object(smoke.time, 'sleep'):
                if duration in (89,90,91):
                    smoke.assert_duration(90)
                else:
                    with self.assertRaises(AssertionError):
                        smoke.assert_duration(90)

    def scroll_frame(self, bounds='[12,688][468,924]', target=False):
        # Measured bounds from failed retest artifact 11732627939: the two
        # status cards leave only this small vertical song viewport.
        button = '<node content-desc="Wanted" bounds="[28,743][290,826]"/>' if target else ''
        return ET.fromstring('<hierarchy><node class="android.widget.HorizontalScrollView" '
                             'scrollable="true" bounds="[0,137][480,195]"/>'
                             '<node class="android.widget.ScrollView" scrollable="true" '
                             f'bounds="{bounds}">{button}</node></hierarchy>')

    def test_scroll_uses_observed_vertical_bounds_and_excludes_horizontal_tabs(self):
        root = self.scroll_frame()
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted'), (240,889,240,723))
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted', down=True), (240,723,240,889))

    def test_scroll_recalculates_bounds_when_scan_cards_disappear(self):
        for bounds, expected in (('[12,618][468,924]', (240,879,240,663)),
                                 ('[12,220][468,780]', (240,696,240,304))):
            self.assertEqual(smoke.vertical_swipe_coordinates(self.scroll_frame(bounds), 'Wanted'), expected)

    def test_scroll_never_guesses_between_ambiguous_unrelated_vertical_surfaces(self):
        root = self.scroll_frame()
        root.append(ET.fromstring('<node class="androidx.recyclerview.widget.RecyclerView" '
                                 'scrollable="true" bounds="[20,220][460,500]"/>'))
        with self.assertRaises(AssertionError):
            smoke.vertical_swipe_coordinates(root, 'Wanted')
        target = ET.SubElement(root[1], 'node', {'content-desc':'Wanted','bounds':'[0,970][100,1020]'})
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted'), (240,889,240,723))

    def test_visible_target_is_used_without_any_unnecessary_scroll(self):
        root = self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', return_value=root), patch.object(smoke, 'adb') as adb:
            self.assertEqual(smoke.scroll_to('Wanted', top=True).get('content-desc'), 'Wanted')
            adb.assert_not_called()

    def test_real_scroll_to_swipes_inside_current_surface_and_rechecks_target(self):
        empty, found = self.scroll_frame(), self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', side_effect=[empty,found]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('content-desc'), 'Wanted')
            adb.assert_called_once_with('shell','input','swipe','240','889','240','723','300')

    def test_system_folder_grant_waits_through_empty_transition_and_is_exact(self):
        empty = ET.fromstring('<hierarchy><node text="3:30"/></hierarchy>')
        grant = ET.fromstring('<hierarchy><node text="Allow k1w1-Musik to access files in V3OnlySAF?"/>'
                             '<node resource-id="android:id/button1" text="ALLOW" enabled="true" bounds="[333,536][432,608]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[empty,grant]), patch.object(smoke.time,'monotonic',side_effect=[0,0,1]), patch.object(smoke.time,'sleep'):
            self.assertEqual(smoke.wait_tree_grant('V3OnlySAF').get('text'),'ALLOW')
        self.assertIsNone(smoke.tree_grant_button(grant,'OtherFolder'))
        grant[1].set('enabled','false')
        self.assertIsNone(smoke.tree_grant_button(grant,'V3OnlySAF'))

    def test_missing_folder_grant_times_out_without_any_confirmation_tap(self):
        with patch.object(smoke,'tree',return_value=ET.fromstring('<hierarchy/>')), patch.object(smoke.time,'monotonic',side_effect=[0,0,26]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tapped:
            with self.assertRaises(AssertionError):
                smoke.wait_tree_grant('V3OnlySAF')
            tapped.assert_not_called()

    def test_compact_action_lookup_keeps_full_fallback_for_pruned_marker(self):
        compact = ET.fromstring('<hierarchy/>')
        full = ET.fromstring('<hierarchy><node resource-id="settings-screen" bounds="[0,36][480,900]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[compact,full]) as capture:
            self.assertEqual(smoke.find('settings-screen').get('resource-id'),'settings-screen')
            self.assertEqual(capture.call_args_list[-1].kwargs,{'compressed':False})

    def test_compact_mini_player_button_still_protects_occluded_song_rows(self):
        root = self.scroll_frame('[12,279][468,894]',target=True)
        root[1][0].set('bounds','[28,746][290,829]')
        ET.SubElement(root,'node',{'resource-id':'mini-player-open','bounds':'[18,808][462,906]'})
        self.assertIsNone(smoke.scroll_candidate('Wanted',root))

    def test_system_picker_uses_innermost_nested_scroll_surface(self):
        root = ET.fromstring('<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,36][480,960]">'
                            '<node class="android.widget.GridView" resource-id="com.google.android.documentsui:id/dir_list" '
                            'scrollable="true" bounds="[0,36][480,960]"><node text="Music" bounds="[317,734][374,763]"/></node></node></hierarchy>')
        self.assertEqual(smoke.vertical_scroll_surface(root,'Music').get('class'),'android.widget.GridView')
        self.assertEqual(smoke.scroll_candidate('Music',root).get('text'),'Music')

    def test_duplicate_targets_on_unrelated_scroll_surfaces_stay_ambiguous(self):
        root = self.scroll_frame(target=True)
        other = ET.SubElement(root,'node',{'class':'android.widget.ScrollView','scrollable':'true','bounds':'[12,220][468,500]'})
        ET.SubElement(other,'node',{'content-desc':'Wanted','bounds':'[28,250][290,333]'})
        with self.assertRaises(AssertionError):
            smoke.vertical_scroll_surface(root,'Wanted')

    def test_scroll_rejects_a_target_partly_covered_by_the_mini_player(self):
        hidden = self.scroll_frame('[12,279][468,894]', target=True)
        hidden[1][0].set('bounds', '[28,746][290,829]')
        ET.SubElement(hidden, 'node', {'resource-id':'mini-player-viewport', 'bounds':'[18,808][462,906]'})
        clear = self.scroll_frame('[12,279][468,894]', target=True)
        clear[1][0].set('bounds', '[28,500][290,583]')
        ET.SubElement(clear, 'node', {'resource-id':'mini-player-viewport', 'bounds':'[18,808][462,906]'})
        for top in (False, True):
            with self.subTest(top=top), patch.object(smoke, 'tree', side_effect=[hidden,clear]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
                result = smoke.scroll_to('Wanted', top=top, limit=1)
                self.assertEqual(result.get('bounds'), '[28,500][290,583]')
                adb.assert_called_once_with('shell','input','swipe','240','729','240','358','300')

    def test_scroll_rejects_a_target_outside_its_native_parent_viewport(self):
        clipped = self.scroll_frame('[12,279][468,600]', target=True)
        clear = self.scroll_frame('[12,279][468,600]', target=True)
        clear[1][0].set('bounds','[28,450][290,533]')
        with patch.object(smoke, 'tree', side_effect=[clipped,clear]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('bounds'), '[28,450][290,533]')
            adb.assert_called_once()

    def test_public_song_tap_requires_its_native_title_ack_before_opening_player(self):
        node = ET.fromstring('<node bounds="[28,500][290,583]"/>')
        with patch.object(smoke,'scroll_to',return_value=node), patch.object(smoke,'tap_node') as tap, patch.object(smoke,'wait_selected_session') as ack, patch.object(smoke,'find'):
            smoke.play_title('V3 SAF')
            tap.assert_called_once_with(node)
            ack.assert_called_once_with('V3 SAF')

    def test_missing_or_offscreen_vertical_surface_is_not_touched(self):
        for bounds in ('[12,970][468,1100]', '[-20,220][468,780]', '[12,688][468,710]'):
            with self.assertRaises(AssertionError):
                smoke.vertical_swipe_coordinates(self.scroll_frame(bounds), 'Wanted')

    def playlist_frame(self, ids=('a','b'), titles=('MP3','M4A'), package=smoke.PACKAGE):
        root = ET.fromstring('<hierarchy><node resource-id="playlist-detail-screen" bounds="[0,0][480,900]"/></hierarchy>')
        for index, (identifier, title) in enumerate(zip(ids,titles)):
            ET.SubElement(root[0], 'node', {'package':package,'resource-id':'playlist-detail-song-'+identifier,
                'content-desc':f'{title} von V3 Proof abspielen. Position {index+1} von {len(ids)}'})
        return root

    def test_backup_restore_requires_real_playlist_ids_order_metadata_and_count(self):
        smoke.validate_playlist_contents(self.playlist_frame(), ['a','b'], ['MP3','M4A'])
        for frame in (self.playlist_frame(ids=('b','a')),self.playlist_frame(titles=('MP3','Wrong')),
                      self.playlist_frame(ids=('a',),titles=('MP3',)),self.playlist_frame(package='com.other.app')):
            with self.assertRaises(AssertionError):
                smoke.validate_playlist_contents(frame,['a','b'],['MP3','M4A'])
        frame=self.playlist_frame();frame[0][0].set('content-desc','MP3 von V3 Proof abspielen. Position 1 von 3')
        with self.assertRaises(AssertionError):
            smoke.validate_playlist_contents(frame,['a','b'],['MP3','M4A'])

    def playing_session(self, title='V3 FLAC', state=3, package=smoke.PACKAGE):
        return f'package={package}\nstate=PlaybackState {{state={state}, position=4000}}\nmetadata: description={title}, V3 Proof'

    def test_selection_ack_is_exact_and_does_not_claim_decoder_playback(self):
        selected = self.playing_session(title='V3 M4A',state=0)
        smoke.validate_selected_session(selected,'V3 M4A')
        with self.assertRaises(AssertionError):
            validate_playing_session(selected,'V3 M4A')
        for title, package in [('V3 M4A extra',smoke.PACKAGE),('V3 FLAC',smoke.PACKAGE),('V3 M4A','com.other.app')]:
            with self.assertRaises(AssertionError):
                smoke.validate_selected_session(self.playing_session(title=title,package=package),'V3 M4A')

    def test_native_session_requires_own_app_playing_and_actual_title(self):
        validate_playing_session(self.playing_session(), 'V3 FLAC')
        for session in (self.playing_session(state=2), self.playing_session(title='V3 M4A'),
                        self.playing_session(package=smoke.PACKAGE+'.other')):
            with self.assertRaises(AssertionError):
                validate_playing_session(session, 'V3 FLAC')

    def native_stack(self, app_state='PLAYING(3)', other_state='PAUSED(2)', app_title='V3 FLAC'):
        # Structure and named state copied from the actual API-35 failing run.
        return f'''MEDIA SESSION SERVICE (dumpsys media_session)
  Sessions Stack - have 2 sessions:
    androidx.media3.session.id. com.k1w1a0style.musikplayer/7 (userId=0)
      ownerPid=4108, ownerUid=10209, userId=0
      package={smoke.PACKAGE}
      active=true
      state=PlaybackState {{state={app_state}, position=33301, speed=1.0}}
      metadata: description={app_title}, V3 Proof
    OtherPlayer com.other.player/2 (userId=0)
      ownerPid=555, ownerUid=12345, userId=0
      package=com.other.player
      state=PlaybackState {{state={other_state}, position=4000, speed=1.0}}
      metadata: description=V3 M4A, Other Artist
Audio playback (lastly played comes first)
  uid=10209 packages={smoke.PACKAGE}
'''

    def read_session(self, dump):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), patch.object(smoke, 'adb', return_value=dump.encode()):
            return smoke.app_media_session()

    def test_observed_android_named_playing_state_and_legacy_numeric_are_supported(self):
        for state in ('PLAYING(3)', '3'):
            session = self.read_session(self.native_stack(app_state=state))
            self.assertNotIn('package=com.other.player', session)
            validate_playing_session(session, 'V3 FLAC')

    def test_a_foreign_playing_session_never_proves_our_paused_player(self):
        session = self.read_session(self.native_stack(app_state='PAUSED(2)', other_state='3'))
        with self.assertRaises(AssertionError):
            validate_playing_session(session, 'V3 FLAC')

    def test_a_foreign_metadata_title_never_proves_our_selected_track(self):
        session = self.read_session(self.native_stack(app_state='3', app_title='Wrong Track'))
        with self.assertRaises(AssertionError):
            validate_playing_session(session, 'V3 M4A')

    def test_duplicate_own_sessions_are_ambiguous_and_named_nonplaying_is_rejected(self):
        duplicate = self.native_stack().replace('package=com.other.player', f'package={smoke.PACKAGE}')
        with self.assertRaises(AssertionError):
            self.read_session(duplicate)
        for state in ('PAUSED(2)', 'PAUSED(3)', 'PLAYING(2)', '33', 'BUFFERING(6)'):
            with self.assertRaises(AssertionError):
                validate_playing_session(self.playing_session(state=state), 'V3 FLAC')

    def test_metadata_only_or_stalled_progress_fails_playback_proof(self):
        for positions in ((4,4), (4,5), (4,40)):
            with patch.object(smoke, 'wait_playing_session'), patch.object(smoke, 'app_media_session', return_value=self.playing_session()), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
                with self.assertRaises(AssertionError):
                    assert_native_playback('V3 FLAC', 150, iter(positions).__next__)
        with patch.object(smoke, 'wait_playing_session'), patch.object(smoke, 'app_media_session', return_value=self.playing_session(state=2)), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
            with self.assertRaises(AssertionError):
                assert_native_playback('V3 FLAC', 150, iter((4,8)).__next__)

    def test_advancing_progress_and_confirmed_session_record_evidence(self):
        previous = list(smoke.PLAYBACK_PROOFS)
        try:
            with patch.object(smoke, 'wait_playing_session') as wait, patch.object(smoke, 'app_media_session', return_value=self.playing_session()), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
                assert_native_playback('V3 FLAC', 150, iter((4,8)).__next__)
                wait.assert_called_once_with('V3 FLAC')
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['beforeSeconds'], 4)
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['afterSeconds'], 8)
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['nativeState'], 3)
        finally:
            smoke.PLAYBACK_PROOFS[:] = previous

    def test_horizontal_cover_swipe_is_rightwards_inside_visible_cover(self):
        node = ET.fromstring('<node bounds="[0,210][480,760]"/>')
        self.assertEqual(horizontal_swipe_coordinates(node), (72,485,408,485))
        for bounds in ('[0,210][80,760]', '[0,210][480,980]'):
            with self.assertRaises(AssertionError):
                horizontal_swipe_coordinates(ET.fromstring(f'<node bounds="{bounds}"/>'))

    def cleaner_bytes(self, title='V5  Cleaner', artist='V5  Proof', audio=b'encoded-MP3-audio', replacements=None):
        values = {'TIT2': b'\x00' + title.encode(), 'TPE1': b'\x00' + artist.encode(), 'APIC': b'cover',
                  'TPUB': b'publisher', 'WXXX': b'website', 'XKIW': b'unknown'}
        values.update(replacements or {})
        body = b''.join(key.encode() + len(value).to_bytes(4, 'big') + b'\x00\x00' + value for key, value in values.items())
        return b'ID3\x03\x00\x00' + smoke.synchsafe(len(body)) + body + audio

    def test_independent_cleaner_proof_requires_audio_and_preserved_frames(self):
        before = self.cleaner_bytes()
        after = self.cleaner_bytes('V5 Cleaner', 'V5 Proof')
        proof = smoke.validate_cleaner_write(before, after)
        self.assertNotEqual(proof['beforeSha256'], proof['afterSha256'])
        self.assertEqual(proof['audioSha256'], hashlib.sha256(b'encoded-MP3-audio').hexdigest())
        for corrupted in [before, self.cleaner_bytes('V5 Cleaner', 'V5 Proof', audio=b'changed audio'),
                          self.cleaner_bytes('V5 Wrong', 'V5 Proof')] + [
                          self.cleaner_bytes('V5 Cleaner', 'V5 Proof', replacements={field: b'changed'})
                          for field in ('APIC', 'TPUB', 'WXXX', 'XKIW')]:
            with self.assertRaises(AssertionError):
                smoke.validate_cleaner_write(before, corrupted)

    def test_independent_cleaner_parser_rejects_truncated_or_unsupported_input(self):
        valid = self.cleaner_bytes()
        for malformed in [valid[:8], valid[:20], valid.replace(b'ID3', b'BAD', 1),
                          valid[:3] + b'\x02' + valid[4:], valid[:5] + b'\x80' + valid[6:]]:
            with self.assertRaises(AssertionError):
                smoke.id3_frames(malformed)
        frames, audio = smoke.id3_frames(valid)
        self.assertEqual(frames['XKIW'], [b'unknown'])
        self.assertEqual(audio, b'encoded-MP3-audio')

    def test_v5_radios_require_the_exact_checked_visible_public_control(self):
        key = 'settings-appAccent-purple'
        for checked, identifier, bounds in [('true', key, '[10,20][110,90]'),
                                           ('false', key, '[10,20][110,90]'),
                                           ('true', 'settings-playerAccent-purple', '[10,20][110,90]'),
                                           ('true', key, '[10,20][110,1000]')]:
            root = ET.fromstring(f'<hierarchy><node resource-id="{identifier}" checked="{checked}" bounds="{bounds}"/></hierarchy>')
            if checked == 'true' and identifier == key and bounds.endswith('90]'):
                smoke.assert_radio_selected(root, key)
            else:
                with self.assertRaises(AssertionError):
                    smoke.assert_radio_selected(root, key)
        self.assertEqual(len(smoke.ACCENT_IDS), 12)
        self.assertEqual(len(set(smoke.ACCENT_IDS)), 12)

    def test_cleaner_confirms_only_the_expected_mode_and_exact_apply_action(self):
        result = ET.fromstring('<hierarchy><node text="synthetic: Anzeige gespeichert"/>'
                              '<node text="1 geprüft · 0 unverändert · 1 geändert · 0 übersprungen · 0 Konflikte · 0 fehlgeschlagen · 0 offen / unterbrochen"/></hierarchy>')
        for title, action, mode in [('Bibliotheksanzeige speichern', 'Ausgewählte Änderungen anwenden', 'display'),
                                    ('Originaldatei-Tags schreiben', 'Ausgewählte Änderungen anwenden', 'display'),
                                    ('Bibliotheksanzeige speichern', 'Löschen', 'display')]:
            dialog = ET.fromstring(f'<hierarchy><node text="{title}"/>'
                                  f'<node resource-id="android:id/button1" text="{action}" bounds="[1,1][80,80]"/></hierarchy>')
            with patch.object(smoke, 'select'), patch.object(smoke, 'find'), patch.object(smoke, 'tap_node') as tapped, patch.object(smoke, 'tree', side_effect=[dialog, result]):
                if title == 'Bibliotheksanzeige speichern' and action.startswith('Ausgewählte'):
                    smoke.cleaner_apply_dialog(mode)
                    tapped.assert_called_once()
                else:
                    with self.assertRaises(AssertionError):
                        smoke.cleaner_apply_dialog(mode)
                    tapped.assert_not_called()

    def test_cleaner_result_rejects_failed_pending_skipped_or_other_mode_success(self):
        summary = '1 geprüft · 0 unverändert · 1 geändert · 0 übersprungen · 0 Konflikte · 0 fehlgeschlagen · 0 offen / unterbrochen'
        valid = ET.fromstring(f'<hierarchy><node text="synthetic: Datei geändert"/><node text="{summary}"/></hierarchy>')
        smoke.validate_cleaner_result(valid, 'file')
        for status, text in [('synthetic: Datei geändert', summary.replace('0 fehlgeschlagen', '1 fehlgeschlagen')),
                             ('synthetic: Datei geändert', summary.replace('0 offen / unterbrochen', '1 offen / unterbrochen')),
                             ('synthetic: Datei geändert', summary.replace('0 übersprungen', '1 übersprungen')),
                             ('synthetic: Datei geändert', summary.replace('1 geprüft', '11 geprüft')),
                             ('synthetic: Anzeige gespeichert', summary),
                             ('synthetic: fehlgeschlagen', summary)]:
            root = ET.fromstring(f'<hierarchy><node text="{status}"/><node text="{text}"/></hierarchy>')
            with self.assertRaises(AssertionError):
                smoke.validate_cleaner_result(root, 'file')

if __name__ == '__main__':
    unittest.main()
