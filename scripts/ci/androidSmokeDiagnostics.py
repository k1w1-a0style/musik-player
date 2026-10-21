"""Collect independent Android diagnostics without replacing the smoke failure."""
import json
from pathlib import Path
import subprocess
import sys


def host_state(output, proc=Path('/proc')):
    state = {'meminfo': (proc / 'meminfo').read_text()}
    pid_file = Path(output).parent / 'emulator.pid'
    if pid_file.exists():
        pid = int(pid_file.read_text().strip())
        assert pid > 0, 'Invalid emulator PID'
        state['emulatorPid'] = pid
        try:
            state['emulatorStatus'] = (proc / str(pid) / 'status').read_text()
        except FileNotFoundError:
            state['emulatorExited'] = True
    return state


def capture_final_snapshot(capture):
    primary_error = sys.exc_info()[1]
    try:
        capture()
    except Exception as error:
        if primary_error is None:
            raise
        print('Final snapshot failed; preserving original smoke failure: ' + repr(error), flush=True)


def collect_diagnostics(output, package, timeout=15):
    output = Path(output)
    errors = {}
    captures = {
        'device-state.txt': ['devices', '-l'],
        'logcat.txt': ['logcat', '-d', '-v', 'threadtime'],
        'gfxinfo.txt': ['shell', 'dumpsys', 'gfxinfo', package],
        'final.png': ['exec-out', 'screencap', '-p'],
    }
    for filename, arguments in captures.items():
        try:
            result = subprocess.run(['adb', *arguments], capture_output=True, timeout=timeout)
            output.mkdir(parents=True, exist_ok=True)
            (output / filename).write_bytes(result.stdout)
            (output / (filename + '.stderr.txt')).write_bytes(result.stderr)
            if result.returncode:
                errors[filename] = {'exitCode': result.returncode,
                                    'stderr': result.stderr.decode(errors='replace')}
        except Exception as error:
            errors[filename] = {'error': str(error)}
    try:
        output.mkdir(parents=True, exist_ok=True)
        (output / 'host-state.json').write_text(json.dumps(host_state(output), indent=2))
    except Exception as error:
        errors['host-state.json'] = {'error': str(error)}
    try:
        output.mkdir(parents=True, exist_ok=True)
        (output / 'diagnostic-errors.json').write_text(json.dumps(errors, indent=2))
    except OSError as error:
        errors['diagnostic-errors.json'] = {'error': str(error)}
    if errors:
        print('Android diagnostic capture failures: ' + json.dumps(errors), flush=True)
    return errors


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output')
    parser.add_argument('package')
    args = parser.parse_args()
    collect_diagnostics(args.output, args.package)
