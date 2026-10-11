import hashlib
from pathlib import Path
import tempfile
import unittest
from androidReleaseInteractionSmoke import (validate_target, rect, matches,
    validate_retest_provenance, import_confirmation_button, FORMAT_DURATIONS)
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

if __name__ == '__main__':
    unittest.main()
