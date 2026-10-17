import unittest
import xml.etree.ElementTree as ET
from androidCleanerGeometry import validate_targets,validate_disjoint
class CleanerGeometryTest(unittest.TestCase):
    def test_native_minimum_and_screen_clip_are_mandatory(self):
        for bounds,valid in [('[10,20][82,92]',True),('[10,20][81,92]',False),('[10,20][82,91]',False),('[10,900][82,972]',False)]:
            root=ET.fromstring(f'<hierarchy><node package="app" resource-id="action" bounds="{bounds}"/></hierarchy>')
            if valid:self.assertEqual(validate_targets(root,['action'],'app')['action'],[10,20,82,92])
            else:
                with self.assertRaises(AssertionError):validate_targets(root,['action'],'app')
    def test_adjacent_actions_must_not_overlap(self):
        validate_disjoint([0,0,72,72],[72,0,144,72])
        with self.assertRaises(AssertionError):validate_disjoint([0,0,72,72],[71,0,143,72])
