"""Collect independent Android diagnostics without replacing the smoke failure."""
import json
from pathlib import Path
import subprocess


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
