import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from androidCleanerGeometry import validate_targets,validate_disjoint
class CleanerGeometryTest(unittest.TestCase):
    def test_recorded_font2_queue_header_cannot_pass_with_clipped_or_small_actions(self):
        # Actual UI artifact 12115397795, run 39070247965, APK source 2ea82559.
        root=ET.parse(Path(__file__).parent/'fixtures'/'queue-header-font2-overflow.xml').getroot()
        with self.assertRaises(AssertionError):
            validate_targets(root,['soundcloud-queue-shuffle','soundcloud-queue-repeat','soundcloud-queue-close'],'com.k1w1a0style.musikplayer')
    def test_native_minimum_and_screen_clip_are_mandatory(self):
        for bounds,valid in [('[10,20][82,92]',True),('[10,20][81,92]',False),('[10,20][82,91]',False),('[10,900][82,972]',False)]:
            root=ET.fromstring(f'<hierarchy><node package="app" resource-id="action" bounds="{bounds}"/></hierarchy>')
            if valid:self.assertEqual(validate_targets(root,['action'],'app')['action'],[10,20,82,92])
            else:
                with self.assertRaises(AssertionError):validate_targets(root,['action'],'app')
    def test_adjacent_actions_must_not_overlap(self):
        validate_disjoint([0,0,72,72],[72,0,144,72])
        with self.assertRaises(AssertionError):validate_disjoint([0,0,72,72],[71,0,143,72])
