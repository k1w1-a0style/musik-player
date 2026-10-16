import copy
import unittest
import xml.etree.ElementTree as ET
from androidReleaseInteractionSmoke import PACKAGE, validate_soundcloud_info_chip

class SoundCloudInfoGeometryTest(unittest.TestCase):
    def frame(self):
        return ET.fromstring(f'''<hierarchy><node resource-id="soundcloud-track-page-current" bounds="[0,0][480,960]">
          <node resource-id="soundcloud-track-metadata" bounds="[27,102][453,423]">
            <node resource-id="soundcloud-track-info-chip" package="{PACKAGE}" enabled="true" content-desc="Infos zu diesem Track" bounds="[27,327][453,423]" />
          </node><node resource-id="soundcloud-paused-controls" bounds="[60,435][420,561]" />
          </node></hierarchy>''')
    def test_fully_visible_large_font_action(self):
        self.assertEqual(validate_soundcloud_info_chip(self.frame())['infoBounds'],[27,327,453,423])
    def test_clipped_small_disabled_foreign_or_overlapping_action_rejected(self):
        changes=[('soundcloud-track-info-chip','bounds','[27,327][453,450]'),('soundcloud-track-info-chip','bounds','[27,327][453,380]'),('soundcloud-track-info-chip','enabled','false'),('soundcloud-track-info-chip','package','foreign'),('soundcloud-track-info-chip','content-desc','Infos …'),('soundcloud-paused-controls','bounds','[60,400][420,526]')]
        for identity,key,value in changes:
            frame=copy.deepcopy(self.frame())
            next(n for n in frame.iter('node') if n.get('resource-id')==identity).set(key,value)
            with self.subTest(identity=identity,key=key,value=value),self.assertRaises(AssertionError): validate_soundcloud_info_chip(frame)

if __name__=='__main__': unittest.main()

class SoundCloudInfoFlowTest(unittest.TestCase):
    def test_all_four_scales_capture_both_layout_and_real_open_route(self):
        from unittest.mock import patch
        import androidReleaseInteractionSmoke as smoke
        frame=ET.fromstring('<hierarchy/>')
        hitbox=ET.fromstring('<node content-desc="Pausieren"/>')
        with patch.object(smoke,'settings'),patch.object(smoke,'select') as select,patch.object(smoke,'back'),patch.object(smoke,'tap') as tap,patch.object(smoke,'tap_node') as tap_node,patch.object(smoke,'find',return_value=hitbox) as find,patch.object(smoke,'adb') as adb,patch.object(smoke,'tree',return_value=frame),patch.object(smoke,'validate_soundcloud_info_chip',return_value={'infoBounds':[0,0,72,72]}),patch.object(smoke,'screenshot') as screenshot,patch.object(smoke.time,'sleep'):
            smoke.soundcloud_info_font_acceptance()
        scales=[call.args[-1] for call in adb.call_args_list]
        self.assertEqual(scales,['1.0','1.3','1.5','2.0','1.0'])
        self.assertEqual(sum(call.args==('track-info-hero',) for call in find.call_args_list),4)
        self.assertEqual(sum(call.args==('soundcloud-track-info-chip',) for call in tap.call_args_list),4)
        self.assertEqual(screenshot.call_count,8)
        self.assertEqual(select.call_args_list[-1].args,('settings-player-layout-classic',))
        tap_node.assert_called_once_with(hitbox)
        self.assertEqual(len(smoke.V5_PROOFS.pop('soundcloudInfoFonts')),4)
        smoke.CHECKS.pop()
