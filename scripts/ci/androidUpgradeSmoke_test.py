import hashlib
import unittest

import androidReleaseInteractionSmoke as ui
from androidUpgradeSmoke import assert_in_place_upgrade, install_receipt, signer_fingerprint


class UpgradeProofTest(unittest.TestCase):
    def test_signer_check_uses_verified_certificate_bytes_independent_of_output_labels(self):
        signature = 'Verified using v2 scheme (APK Signature Scheme v2): true'
        certificate = '-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----'
        self.assertEqual(signer_fingerprint(signature + '\n' + certificate), hashlib.sha256(b'abc').hexdigest())
        for report in (certificate, signature, signature + '\n' + certificate * 2):
            with self.assertRaises(AssertionError):
                signer_fingerprint(report)

    def test_package_receipt_requires_same_install_and_exact_versions(self):
        before = install_receipt(
            '  userId=10078\n  versionCode=14 minSdk=24\n  versionName=1.0.2-test.12\n'
            '    firstInstallTime=2026-11-19 02:20:00\n')
        after = install_receipt(
            '  appId=10078\n  versionCode=20 minSdk=24\n  versionName=1.0.2-test.18\n'
            '    firstInstallTime=2026-11-19 02:20:00\n')
        assert_in_place_upgrade(before, after)
        for change in ({'uid': '10079'}, {'versionCode': '19'}, {'firstInstallTime': '2026-11-19 02:20:10'}):
            with self.assertRaises(AssertionError):
                assert_in_place_upgrade(before, {**after, **change})

    def test_receipt_rejects_ambiguous_package_versions(self):
        with self.assertRaisesRegex(AssertionError, 'versionCode'):
            install_receipt('  appId=10078\n  firstInstallTime=2026-11-19 02:20:00\n  versionCode=14\n  versionCode=20\n')

    def test_numeric_and_named_media_sessions_keep_strict_state_identity_and_clock(self):
        for label in ('3', 'PLAYING(3)'):
            session = (f'  package={ui.PACKAGE}\n  metadata: size=4, description=V7LongFLAC, V3 Proof, null\n'
                       f'  state=PlaybackState {{state={label}, position=3159000, buffered position=3165000, '
                       'speed=1.0, updated=98765, actions=42}\n')
            self.assertEqual(ui.native_position_clock(session, 'V7LongFLAC', 'PLAYING'), (3159.0, 98.765))
            with self.assertRaises(AssertionError):
                ui.native_position_clock(session, 'V7LongWAV', 'PLAYING')
            with self.assertRaises(AssertionError):
                ui.native_position_clock(session, 'V7LongFLAC', 'PAUSED')
