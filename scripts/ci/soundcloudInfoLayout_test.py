import copy
import unittest
import xml.etree.ElementTree as ET
from androidReleaseInteractionSmoke import PACKAGE, validate_soundcloud_info_chip

class SoundCloudInfoGeometryTest(unittest.TestCase):
    def frame(self):
        return ET.fromstring(f'''<hierarchy><node resource-id="soundcloud-track-page-current" bounds="[0,0][480,960]">
          <node resource-id="soundcloud-track-metadata" package="{PACKAGE}" bounds="[27,102][453,423]">
            <node resource-id="soundcloud-track-info-chip" package="{PACKAGE}" enabled="true" content-desc="Infos zu diesem Track" bounds="[27,327][453,423]" />
          </node><node resource-id="soundcloud-paused-controls" package="{PACKAGE}" bounds="[60,435][420,561]" />
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
        with patch.object(smoke,'settings'),patch.object(smoke,'wait_uncovered_library_header'),patch.object(smoke,'wait_selected_session'),patch.object(smoke,'select') as select,patch.object(smoke,'back'),patch.object(smoke,'tap') as tap,patch.object(smoke,'tap_node') as tap_node,patch.object(smoke,'find',return_value=hitbox) as find,patch.object(smoke,'adb') as adb,patch.object(smoke,'tree',return_value=frame),patch.object(smoke,'validate_soundcloud_info_chip',return_value={'infoBounds':[0,0,72,72]}),patch.object(smoke,'screenshot') as screenshot,patch.object(smoke.time,'sleep'):
            smoke.soundcloud_info_font_acceptance()
        scales=[call.args[-1] for call in adb.call_args_list]
        self.assertEqual(scales,['1.0','1.3','1.5','2.0','1.0'])
        self.assertEqual(sum(call.args==('track-info-hero',) for call in find.call_args_list),4)
        self.assertEqual(sum(call.args==('soundcloud-track-info-chip',) for call in tap.call_args_list),4)
        self.assertEqual(screenshot.call_count,8)
        self.assertEqual(select.call_args_list[-1].args,('settings-player-layout-classic',))
        self.assertEqual(tap_node.call_count,4)
        self.assertTrue(all(call.args==(hitbox,) for call in tap_node.call_args_list))
        self.assertEqual(len(smoke.V5_PROOFS.pop('soundcloudInfoFonts')),4)
        smoke.CHECKS.pop()

class RecordedAndroidSoundCloudTest(unittest.TestCase):
    def test_real_native_z_order_siblings_are_owned_by_the_current_page_render_container(self):
        from pathlib import Path
        frame=ET.parse(Path(__file__).parent/'fixtures/soundcloud-native-z-order.xml').getroot()
        result=validate_soundcloud_info_chip(frame)
        self.assertEqual(result['infoBounds'],[27,255,294,327])
        self.assertEqual(result['transportBounds'],[51,393,429,519])
    def test_ambiguous_visible_chip_is_rejected_instead_of_borrowing_another_page(self):
        from pathlib import Path
        frame=ET.parse(Path(__file__).parent/'fixtures/soundcloud-native-z-order.xml').getroot()
        chip=next(n for n in frame.iter('node') if n.get('resource-id')=='soundcloud-track-info-chip')
        frame.append(copy.deepcopy(chip))
        with self.assertRaises(AssertionError): validate_soundcloud_info_chip(frame)

class SoundCloudFontActivityLifecycleTest(unittest.TestCase):
    def test_each_font_change_starts_in_library_and_explicitly_reopens_the_same_native_track(self):
        from pathlib import Path
        from unittest.mock import patch
        import androidReleaseInteractionSmoke as smoke
        library=ET.parse(Path(__file__).parent/'fixtures/soundcloud-font-change-library.xml').getroot()
        player=ET.parse(Path(__file__).parent/'fixtures/soundcloud-native-z-order.xml').getroot()
        header=smoke.candidate('library-open-menu',library)
        self.assertIsNotNone(header)
        route='library'
        opens=[]
        def adb(*args):
            nonlocal route
            if args[:5]==('shell','settings','put','system','font_scale'):
                self.assertEqual(route,'library','Font change would recreate Activity and dismiss the open player')
                route='library'
        def back():
            nonlocal route
            route='player' if route=='info' else 'library'
        def tap(key):
            nonlocal route
            if key=='mini-player-open':
                self.assertEqual(route,'library');self.assertIsNotNone(smoke.candidate(key,library));route='player';opens.append(key)
            elif key=='soundcloud-track-info-chip':
                self.assertEqual(route,'player');route='info'
        def find(key):
            if key=='track-info-hero':
                self.assertEqual(route,'info');return ET.Element('node')
            self.assertEqual(route,'player')
            if key=='soundcloud-swipe-hitbox':return ET.fromstring('<node content-desc="Abspielen"/>')
            return smoke.candidate(key,player) or ET.Element('node')
        def stable_header():
            self.assertEqual(route,'library');return header
        with patch.object(smoke,'settings'),patch.object(smoke,'select'),patch.object(smoke,'back',side_effect=back),patch.object(smoke,'adb',side_effect=adb),patch.object(smoke,'tap',side_effect=tap),patch.object(smoke,'find',side_effect=find),patch.object(smoke,'wait_uncovered_library_header',side_effect=stable_header),patch.object(smoke,'wait_selected_session') as selected,patch.object(smoke,'tree',return_value=player),patch.object(smoke,'screenshot'),patch.object(smoke.time,'sleep'):
            smoke.soundcloud_info_font_acceptance()
        self.assertEqual(len(opens),4)
        self.assertEqual(selected.call_args_list,[unittest.mock.call(smoke.TITLES[0])]*4)
        smoke.V5_PROOFS.pop('soundcloudInfoFonts');smoke.CHECKS.pop()
