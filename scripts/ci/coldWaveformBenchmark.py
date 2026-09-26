#!/usr/bin/env python3
"""Generate the same real-audio fixtures as the UI smoke or collect paired timings."""
import argparse
import json
from pathlib import Path
import statistics
import subprocess


def generate(directory):
    directory.mkdir(parents=True, exist_ok=True)
    for name, seconds, codec, frequency in [('A.mp3', 180, 'libmp3lame', 330),
                                          ('B.m4a', 90, 'aac', 550), ('C.flac', 120, 'flac', 880)]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                        f'aevalsrc=0.5*sin(2*PI*{frequency}*t)*(0.2+0.8*abs(sin(2*PI*t/9))):s=44100:d={seconds}',
                        '-ac', '2', '-c:a', codec, '-threads', '1', str(directory / name)], check=True)


def collect(log):
    results = []
    marker = 'COLD_WAVEFORM_BENCHMARK '
    for line in log.read_text().splitlines():
        if marker not in line:
            continue
        item = json.loads(line.split(marker, 1)[1])
        for key in ('baselineMs', 'candidateMs'):
            assert len(item[key]) == 4 and all(value > 0 for value in item[key]), item
        assert item['points'] == 1024 and item['maxPointDelta'] <= 0.01, item
        item['baselineMedianMs'] = statistics.median(item['baselineMs'])
        item['candidateMedianMs'] = statistics.median(item['candidateMs'])
        item['speedup'] = round(item['baselineMedianMs'] / item['candidateMedianMs'], 3)
        results.append(item)
    assert sorted(item['file'] for item in results) == ['A.mp3', 'B.m4a', 'C.flac'], results
    return {'method': 'fresh decoder and no waveform cache; alternating order; shared OS file cache',
            'results': results}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['generate', 'collect'])
    parser.add_argument('path', type=Path)
    args = parser.parse_args()
    if args.mode == 'generate':
        generate(args.path)
    else:
        print(json.dumps(collect(args.path), indent=2))
