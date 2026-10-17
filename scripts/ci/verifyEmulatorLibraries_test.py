import unittest
from verifyEmulatorLibraries import validate_output


class EmulatorLibrariesTest(unittest.TestCase):
    def test_resolved_ldd_report_passes(self):
        validate_output('linux-vdso.so.1 (0x00007fff)\nlibpulse.so.0 => /lib/x86_64-linux-gnu/libpulse.so.0 (0x0010)\n')

    def test_missing_library_rejects_without_external_search_tool(self):
        with self.assertRaisesRegex(AssertionError, 'Unresolved.*libpulse.so.0'):
            validate_output('linux-vdso.so.1 (0x00007fff)\nlibpulse.so.0 => not found\n')

    def test_empty_report_is_not_a_success(self):
        for text in ('', ' \n\t'):
            with self.assertRaisesRegex(AssertionError, 'Empty'):
                validate_output(text)
