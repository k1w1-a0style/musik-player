import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from androidSmokeDiagnostics import collect_diagnostics


class AndroidDiagnosticsTest(unittest.TestCase):
    def test_screenshot_failure_keeps_other_diagnostics_and_primary_error(self):
        def run(command, **kwargs):
            failed = 'screencap' in command
            return subprocess.CompletedProcess(command, 255 if failed else 0,
                                               b'' if failed else b'available',
                                               b'device offline' if failed else b'')

        with tempfile.TemporaryDirectory() as folder, patch('subprocess.run', side_effect=run):
            with self.assertRaisesRegex(AssertionError, 'original player failure'):
                try:
                    raise AssertionError('original player failure')
                finally:
                    collect_diagnostics(folder, 'test.dev')
            root = Path(folder)
            self.assertEqual((root / 'logcat.txt').read_bytes(), b'available')
            self.assertEqual((root / 'gfxinfo.txt').read_bytes(), b'available')
            self.assertEqual((root / 'final.png.stderr.txt').read_bytes(), b'device offline')
            errors = json.loads((root / 'diagnostic-errors.json').read_text())
            self.assertEqual(errors['final.png']['exitCode'], 255)

    def test_stalled_logcat_is_bounded_and_does_not_skip_screenshot(self):
        def run(command, **kwargs):
            self.assertEqual(kwargs['timeout'], 15)
            if 'logcat' in command:
                raise subprocess.TimeoutExpired(command, 15)
            return subprocess.CompletedProcess(command, 0, b'captured', b'')

        with tempfile.TemporaryDirectory() as folder, patch('subprocess.run', side_effect=run):
            errors = collect_diagnostics(folder, 'test.dev')
            self.assertIn('timed out', errors['logcat.txt']['error'])
            self.assertEqual((Path(folder) / 'final.png').read_bytes(), b'captured')

    def test_unwritable_output_does_not_replace_the_smoke_error(self):
        with tempfile.TemporaryDirectory() as folder, patch('subprocess.run') as run:
            path = Path(folder) / 'occupied'
            path.write_text('existing file')
            run.return_value = subprocess.CompletedProcess(['adb'], 0, b'data', b'')
            errors = collect_diagnostics(path, 'test.dev')
            self.assertEqual(run.call_count, 4)
            self.assertIn('diagnostic-errors.json', errors)
            self.assertEqual(path.read_text(), 'existing file')
