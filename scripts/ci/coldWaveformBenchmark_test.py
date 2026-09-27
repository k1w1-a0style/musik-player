import json
from pathlib import Path
import tempfile
import unittest
from coldWaveformBenchmark import collect


class BenchmarkCollectionTest(unittest.TestCase):
    def collect_rows(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'logcat.txt'
            log.write_text('\n'.join('I/WaveformBenchmark: COLD_WAVEFORM_BENCHMARK ' + json.dumps(row)
                                     for row in rows))
            return collect(log)

    def rows(self, candidate=None):
        return [{'file': name, 'baselineMs': [1000, 1000, 1000, 90000],
                 'candidateMs': candidate or [490, 500, 500, 510], 'maxPointDelta': 0.001, 'points': 1024}
                for name in ['A.mp3', 'B.m4a', 'C.flac']]

    def test_reports_paired_medians_without_treating_one_outlier_as_the_baseline(self):
        result = self.collect_rows(self.rows())['results'][0]
        self.assertEqual(result['baselineMedianMs'], 1000)
        self.assertEqual(result['candidateMedianMs'], 500)
        self.assertEqual(result['speedup'], 2)

    def test_reports_a_slowdown_honestly(self):
        result = self.collect_rows(self.rows([1900, 2000, 2000, 2100]))['results'][0]
        self.assertEqual(result['speedup'], 0.5)

    def test_rejects_an_incomplete_format_comparison(self):
        with self.assertRaises(AssertionError):
            self.collect_rows(self.rows()[:2])

    def test_rejects_invalid_time_or_changed_envelope(self):
        for key, value in [('candidateMs', [0, 1, 2, 3]), ('maxPointDelta', 0.1), ('points', 512)]:
            with self.subTest(key=key):
                rows = self.rows()
                rows[0][key] = value
                with self.assertRaises(AssertionError):
                    self.collect_rows(rows)


if __name__ == '__main__':
    unittest.main()
