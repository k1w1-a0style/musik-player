#!/usr/bin/env python3
"""Reject unresolved emulator libraries without depending on a search command."""
from pathlib import Path
import os
import subprocess
import sys


def validate_output(text):
    assert text.strip(), 'Empty native emulator dependency report'
    missing = [line.strip() for line in text.splitlines() if 'not found' in line]
    assert not missing, 'Unresolved native emulator runtime dependency: ' + '; '.join(missing)


def inspect_libraries(emulator_root, report):
    root = Path(emulator_root).resolve()
    binary = root / 'qemu/linux-x86_64/qemu-system-x86_64'
    assert binary.is_file() and (root / 'lib64').is_dir(), 'Incomplete emulator installation'
    # The SDK launcher supplies these bundled library paths before executing
    # QEMU; raw ldd without them falsely reports packaged Qt/core libs missing.
    # https://android.googlesource.com/platform/external/qemu/+/emu-master-dev/android/docs/PREBUILT-BINARIES.TXT
    directories = [root / suffix for suffix in
                   ('lib64', 'lib64/qt/lib', 'lib64/qt', 'lib64/gles_swiftshader', 'lib64/vulkan')]
    environment = dict(os.environ, LD_LIBRARY_PATH=os.pathsep.join(str(p) for p in directories if p.is_dir()))
    result = subprocess.run(['ldd', str(binary)], env=environment, capture_output=True, text=True, timeout=30)
    text = result.stdout + result.stderr
    Path(report).write_text(text)
    assert result.returncode == 0, 'Native emulator linker inspection failed: ' + text
    validate_output(text)


if __name__ == '__main__':
    inspect_libraries(sys.argv[1], sys.argv[2])
    print('Native emulator runtime dependencies verified.')
