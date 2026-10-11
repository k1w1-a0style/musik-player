import hashlib
from pathlib import Path
import tempfile
import unittest
from androidReleaseInteractionSmoke import validate_target, rect, matches
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

if __name__ == '__main__':
    unittest.main()
