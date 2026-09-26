"""Exercise the smoke's row assertions without Android or UI driver imports."""
import ast
from pathlib import Path
import re
import unittest
from unittest.mock import Mock
import xml.etree.ElementTree as ET


class Clock:
    def __init__(self):
        self.now = 0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def rows(order, positions=None):
    tree = ET.Element('hierarchy')
    for index, letter in enumerate(order):
        top = positions[index] if positions else 134 + index * 89
        ET.SubElement(tree, 'node', {'resource-id': 'queue-row-smoke-' + letter,
                                   'bounds': f'[11,{top}][530,{top + 89}]'})
    return tree


class RowOrderTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.snapshot = Mock()
        self.namespace = {'re': re, 'time': self.clock, 'ui': self.snapshot}
        # Load the actual assertion functions; importing this device-only script
        # would connect to Android and require its optional UI-driver packages.
        source = ast.parse(Path(__file__).with_name('androidPlayerInteractionSmoke.py').read_text())
        names = {'matches', 'bounds', 'assert_row_order', 'assert_queue_order'}
        functions = [node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names]
        exec(compile(ast.Module(body=functions, type_ignores=[]), '<smoke-row-assertions>', 'exec'), self.namespace)

        def find(key):
            return next(node for node in self.snapshot().iter('node')
                        if self.namespace['matches'](node, key))
        self.namespace['find'] = find

    def assert_order(self):
        self.namespace['assert_queue_order']('cba')

    def test_reorder_cannot_mix_positions_from_different_snapshots(self):
        self.snapshot.side_effect = [rows('acb'), rows('cba'), rows('cba')]
        self.assert_order()

    def test_waits_for_overlapping_animation_rows_to_settle(self):
        self.snapshot.side_effect = [rows('cba', [223, 223, 313]), rows('cba'), rows('cba')]
        self.assert_order()

    def test_accepts_the_single_pixel_boundary_overlap_reported_by_android(self):
        tree = rows('acb')
        # Exact final bounds from API 35 at 210 dpi in Android run #36.
        for node, rect in zip(tree.iter('node'), [
                '[11,134][530,224]', '[11,223][530,312]', '[11,313][530,402]']):
            node.set('bounds', rect)
        self.snapshot.return_value = tree
        self.namespace['assert_queue_order']('acb')

    def test_rejects_more_than_one_pixel_of_boundary_overlap(self):
        self.snapshot.return_value = rows('cba', [134, 221, 313])
        with self.assertRaises(AssertionError):
            self.assert_order()

    def test_wrong_order_still_fails_with_a_bounded_wait(self):
        self.snapshot.return_value = rows('acb')
        with self.assertRaisesRegex(AssertionError, 'Wrong.*order'):
            self.assert_order()
        self.assertLessEqual(self.clock.now, 9)

    def test_duplicate_row_identity_is_not_accepted(self):
        self.snapshot.return_value = rows('ccba')
        with self.assertRaises(AssertionError):
            self.assert_order()


if __name__ == '__main__':
    unittest.main()
