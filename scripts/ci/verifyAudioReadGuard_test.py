import struct
import unittest
import verifyAudioReadGuard as guard


def fixture(defined=True):
    descriptor = guard.POLICY.encode()
    data = bytearray(160 + len(descriptor) + 2)
    data[:4] = b'dex\n'
    struct.pack_into('<II', data, 56, 1, 112)
    struct.pack_into('<II', data, 64, 1, 116)
    struct.pack_into('<II', data, 96, int(defined), 120)
    struct.pack_into('<I', data, 112, 160)
    data[160] = len(descriptor)
    data[161:161+len(descriptor)] = descriptor
    return data


class CompiledPolicyTest(unittest.TestCase):
    def test_requires_actual_class_definition_not_a_string_reference(self):
        self.assertEqual(guard.dex_classes(fixture()), {guard.POLICY})
        self.assertEqual(guard.dex_classes(fixture(False)), set())

    def test_rejects_truncated_class_table(self):
        data = fixture()
        struct.pack_into('<II', data, 96, 100, 120)
        with self.assertRaises(AssertionError):
            guard.dex_classes(data)
