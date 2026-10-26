"""Verify the patched policy is defined in the actual APK, not only node_modules."""
import struct
import sys
import zipfile

POLICY = 'Lexpo/modules/medialibrary/AudioReadPermissionPolicy;'
MODULE = 'Lexpo/modules/medialibrary/MediaLibraryModule;'


def dex_classes(data):
    assert data[:4] == b'dex\n' and len(data) >= 112, 'Invalid DEX header'
    strings_count, strings_offset = struct.unpack_from('<II', data, 56)
    types_count, types_offset = struct.unpack_from('<II', data, 64)
    classes_count, classes_offset = struct.unpack_from('<II', data, 96)
    assert strings_offset + strings_count * 4 <= len(data)
    assert types_offset + types_count * 4 <= len(data)
    assert classes_offset + classes_count * 32 <= len(data)
    result = set()
    for index in range(classes_count):
        type_index = struct.unpack_from('<I', data, classes_offset + index * 32)[0]
        assert type_index < types_count
        string_index = struct.unpack_from('<I', data, types_offset + type_index * 4)[0]
        assert string_index < strings_count
        offset = struct.unpack_from('<I', data, strings_offset + string_index * 4)[0]
        # Skip the ULEB128 UTF-16 length. Class descriptors themselves are ASCII.
        while data[offset] & 0x80:
            offset += 1
        offset += 1
        result.add(data[offset:data.index(b'\0', offset)].decode('ascii'))
    return result


def verify_apk(path):
    classes = set()
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            if name.startswith('classes') and name.endswith('.dex'):
                classes.update(dex_classes(archive.read(name)))
    assert MODULE in classes, 'MediaLibrary module is absent from APK'
    assert POLICY in classes, 'Patched AudioReadPermissionPolicy is absent: precompiled Expo artifact may have bypassed the patch'
    return 'Compiled MediaLibrary audio-read policy: verified in APK DEX class definitions'


if __name__ == '__main__':
    print(verify_apk(sys.argv[1]))
