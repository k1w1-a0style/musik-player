#!/usr/bin/env python3
"""Reject unresolved emulator libraries without depending on a search command."""
from pathlib import Path
import sys


def validate_output(text):
    assert text.strip(), 'Empty native emulator dependency report'
    missing = [line.strip() for line in text.splitlines() if 'not found' in line]
    assert not missing, 'Unresolved native emulator runtime dependency: ' + '; '.join(missing)


if __name__ == '__main__':
    validate_output(Path(sys.argv[1]).read_text())
    print('Native emulator runtime dependencies verified.')
