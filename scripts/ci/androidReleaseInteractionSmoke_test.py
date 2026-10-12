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
        for path in ('App.tsx','package-lock.json','modules/expo-system-audio/android/build.gradle',
                     '.github/workflows/ci.yml'):
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

    def playing_session(self, title='V3 FLAC', state=3, package=smoke.PACKAGE):
        return f'package={package}\nstate=PlaybackState {{state={state}, position=4000}}\nmetadata: description={title}, V3 Proof'

    def test_native_session_requires_own_app_playing_and_actual_title(self):
        validate_playing_session(self.playing_session(), 'V3 FLAC')
        for session in (self.playing_session(state=2), self.playing_session(title='V3 M4A'),
                        self.playing_session(package=smoke.PACKAGE+'.other')):
            with self.assertRaises(AssertionError):
                validate_playing_session(session, 'V3 FLAC')

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

if __name__ == '__main__':
    unittest.main()
