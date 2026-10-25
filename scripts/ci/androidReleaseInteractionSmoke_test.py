import hashlib
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import Mock, patch
import json
import androidReleaseInteractionSmoke as smoke
from androidReleaseInteractionSmoke import (validate_target, rect, matches,
    validate_retest_provenance, import_confirmation_button, pixel_launcher_close_button, app_time_values, FORMAT_DURATIONS,
    time_seconds, timeline_values, validate_playing_session, horizontal_swipe_coordinates, assert_native_playback)
import xml.etree.ElementTree as ET

class ReleaseAcceptanceSafetyTest(unittest.TestCase):
    def completed_font2_fixture(self):
        harness='f5ff31bef3dfc9457f6d4b5710ab0ea9539157b5'
        cases=[{'fontScale':'2.0','appearance':a,'skin':s,'density':d,
                'sectionPlayback':{'title':smoke.TITLES[2],'nativeState':3}}
               for a in ('dark','light') for s in ('graphite','minimal','neon-cover') for d in ('standard','compact')]
        data={'sourceCommit':'a'*40,'apkSha256':'b'*64,'harnessCommit':harness,
              'status':'stage-only-passed','mode':'v5-section-font2','releaseAccepted':False,'v5Proofs':{'matrix':cases}}
        run={'id':38773283526,'head_sha':harness,'status':'completed','conclusion':'failure'}
        names=('Verify the acceptance harness regressions before device work',
               'Reject changed app sources, failed original gates or altered APK bytes',
               'Verify twelve affected font2 variants on the new APK')
        jobs=[{'head_sha':harness,'status':'completed','steps':[{'name':n,'conclusion':'success'} for n in names]}]
        artifact={'id':11994031824,'workflow_run':{'id':run['id'],'head_sha':harness},'expired':False,
                  'digest':'sha256:f1e4a4f0179fcc2c6eb3f9fd1324797ca28468820ad950e8fd918f9536f2f865'}
        return data,run,jobs,artifact

    def test_completed_font2_stage_retains_exact_twelve_without_claiming_failed_full_run_passed(self):
        data,run,jobs,artifact=self.completed_font2_fixture()
        origin=smoke.validate_completed_font2_stage(data,run,jobs,artifact,'a'*40,'b'*64)
        self.assertEqual(origin['passed'],12)
        self.assertIs(data['releaseAccepted'],False)
        self.assertEqual(run['conclusion'],'failure')

    def test_completed_font2_rejects_wrong_bytes_origin_missing_case_or_failed_guard(self):
        for change in ('source','bytes','harness','digest','artifact','guard','missing'):
            data,run,jobs,artifact=self.completed_font2_fixture()
            if change=='source':data['sourceCommit']='c'*40
            elif change=='bytes':data['apkSha256']='c'*64
            elif change=='harness':run['head_sha']='c'*40
            elif change=='digest':artifact['digest']='sha256:'+'c'*64
            elif change=='artifact':artifact['id']=1
            elif change=='guard':jobs[0]['steps'][1]['conclusion']='failure'
            else:data['v5Proofs']['matrix'].pop()
            with self.subTest(change=change), self.assertRaises(AssertionError):
                smoke.validate_completed_font2_stage(data,run,jobs,artifact,'a'*40,'b'*64)
    def test_settings_requires_stable_header_and_menu_ack_before_any_scroll(self):
        header=ET.fromstring(f'<node package="{smoke.PACKAGE}" enabled="true" bounds="[378,73][450,145]"/>')
        action=ET.fromstring(f'<node package="{smoke.PACKAGE}" enabled="true" bounds="[24,480][456,552]"/>')
        events=[]
        def find(key):
            events.append(key)
            return ET.Element('node',{'package':smoke.PACKAGE})
        with patch.object(smoke,'wait_uncovered_library_header',side_effect=lambda:events.append('stable-header') or header), \
             patch.object(smoke,'tap_node',side_effect=lambda n:events.append('header-tap' if n is header else 'settings-tap')), \
             patch.object(smoke,'find',side_effect=find), patch.object(smoke,'tap',side_effect=AssertionError('Unstable header tap')), \
             patch.object(smoke,'scroll_to',side_effect=lambda k:events.append('owned-menu-scroll') or action):
            smoke.settings()
        self.assertEqual(events,['stable-header','header-tap','library-menu-card','owned-menu-scroll','settings-tap','settings-screen'])

    def test_settings_never_scrolls_underlying_library_when_menu_did_not_open(self):
        header=ET.fromstring(f'<node package="{smoke.PACKAGE}" enabled="true" bounds="[378,73][450,145]"/>')
        with patch.object(smoke,'wait_uncovered_library_header',return_value=header), patch.object(smoke,'tap_node'), \
             patch.object(smoke,'find',side_effect=AssertionError('Menu opening not acknowledged')), patch.object(smoke,'scroll_to') as scroll, \
             patch.object(smoke,'tap'):
            with self.assertRaisesRegex(AssertionError,'Menu opening not acknowledged'):smoke.settings()
            scroll.assert_not_called()
        with patch.object(smoke,'wait_uncovered_library_header',return_value=header), patch.object(smoke,'tap_node'), \
             patch.object(smoke,'find',return_value=ET.Element('node',{'package':'other.app'})), patch.object(smoke,'scroll_to') as scroll:
            with self.assertRaisesRegex(AssertionError,'not app-owned'):smoke.settings()
            scroll.assert_not_called()
    def test_matrix_pauses_through_recorded_playing_hitbox_before_visible_controls(self):
        hitbox=ET.fromstring(f'<node resource-id="soundcloud-swipe-hitbox" package="{smoke.PACKAGE}" enabled="true" content-desc="Pausieren" bounds="[0,306][480,585]"/>')
        events=[]
        def find(key):
            if key=='soundcloud-swipe-hitbox':return hitbox
            self.assertEqual(key,'soundcloud-play-button')
            self.assertEqual(events,['public-pause','native-pause-ack'])
            return ET.Element('node')
        with patch.object(smoke,'find',side_effect=find), patch.object(smoke,'tap_node',side_effect=lambda n:events.append('public-pause')), \
             patch.object(smoke,'wait_paused_session',side_effect=lambda t:events.append('native-pause-ack')) as paused:
            smoke.pause_matrix_player(smoke.TITLES[2])
            paused.assert_called_once_with(smoke.TITLES[2])

    def test_matrix_cannot_pause_foreign_disabled_or_already_paused_hitbox(self):
        for change in ({'package':'other.app'},{'enabled':'false'},{'content-desc':'Abspielen'}):
            data={'package':smoke.PACKAGE,'enabled':'true','content-desc':'Pausieren','bounds':'[0,306][480,585]'};data.update(change)
            with patch.object(smoke,'find',return_value=ET.Element('node',data)), patch.object(smoke,'tap_node') as tap:
                with self.assertRaisesRegex(AssertionError,'pause action'):smoke.pause_matrix_player(smoke.TITLES[2])
                tap.assert_not_called()
    def section_frame(self):
        root=ET.Element('hierarchy')
        for key,area in {
            'library-section-header':'[12,260][468,500]',
            'library-section-title':'[12,260][250,304]',
            'library-song-view-control':'[12,316][180,388]',
            'library-sort-control':'[192,316][340,388]',
            'library-shuffle-button':'[12,400][84,472]',
            'library-play-button':'[96,400][168,472]',
        }.items():
            ET.SubElement(root,'node',{'resource-id':key,'package':smoke.PACKAGE,'enabled':'true','bounds':area})
        return root

    def test_targeted_font2_requires_all_twelve_real_play_acknowledgements(self):
        cases=[{'fontScale':'2.0','appearance':a,'skin':s,'density':d,
                'sectionPlayback':{'title':smoke.TITLES[2],'nativeState':3}}
               for a in ('dark','light') for s in ('graphite','minimal','neon-cover') for d in ('standard','compact')]
        smoke.validate_font2_matrix_coverage(cases)
        for broken in (cases[:-1],cases[:-1]+[cases[0]],cases+[cases[0]]):
            with self.assertRaises(AssertionError):smoke.validate_font2_matrix_coverage(broken)
        for change in ({'fontScale':'1.3'},{'sectionPlayback':{'title':smoke.TITLES[0],'nativeState':3}},
                       {'sectionPlayback':{'title':smoke.TITLES[2],'nativeState':2}}):
            bad=[dict(c) for c in cases];bad[0].update(change)
            with self.assertRaises(AssertionError):smoke.validate_font2_matrix_coverage(bad)

    def test_section_accepts_wrapped_title_and_whole_48dp_actions(self):
        proof=smoke.validate_library_section_touch_areas(self.section_frame())
        self.assertEqual(proof['controls']['library-play-button'],[96,400,168,472])

    def test_section_rejects_recorded_14px_play_and_other_unsafe_actions(self):
        for key,attribute,value,error in (
            ('library-play-button','bounds','[466,281][480,335]','clipped|48dp'),
            ('library-play-button','bounds','[10,400][82,472]','clipped|overlap'),
            ('library-play-button','bounds','[20,400][92,472]','overlap'),
            ('library-sort-control','package','other.app','app-owned'),
            ('library-shuffle-button','enabled','false','enabled'),
            ('library-section-title','bounds','[12,260][480,304]','clipped'),
        ):
            with self.subTest(key=key,value=value):
                frame=self.section_frame()
                next(n for n in frame if n.get('resource-id')==key).set(attribute,value)
                with self.assertRaisesRegex(AssertionError,error):
                    smoke.validate_library_section_touch_areas(frame)

    def header_frame(self, banner=False, enabled='true', bounds='[393,58][450,115]'):
        root = ET.fromstring(f'<hierarchy><node resource-id="library-open-menu" package="{smoke.PACKAGE}" enabled="{enabled}" bounds="{bounds}"/></hierarchy>')
        if banner:
            ET.SubElement(root, 'node', {'resource-id':'playback-recovery-banner','bounds':'[18,56][462,220]'})
        return root

    def test_cold_header_requires_uncovered_three_stable_frames(self):
        ready = self.header_frame()
        frames = [self.header_frame(banner=True), ready, ready, self.header_frame(banner=True), ready, ready, ready]
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=frames) as tree, patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'tap_node') as tap:
            self.assertEqual(smoke.wait_uncovered_library_header().get('resource-id'), 'library-open-menu')
            self.assertEqual(tree.call_count, 7)
            self.assertTrue(all(call.kwargs == {'compressed':False} for call in tree.call_args_list))
            tap.assert_not_called()

    def test_cold_header_persistent_overlay_and_disabled_control_still_fail(self):
        for frame in [self.header_frame(banner=True), self.header_frame(enabled='false')]:
            clock = iter(range(100))
            with patch.object(smoke, 'tree', return_value=frame), patch.object(smoke.time, 'sleep'), \
                 patch.object(smoke.time, 'monotonic', side_effect=lambda:next(clock)):
                with self.assertRaisesRegex(AssertionError, 'remains covered'):
                    smoke.wait_uncovered_library_header(timeout=5)

    def test_cleaner_rules_scroll_to_the_whole_analyze_action_after_selection(self):
        song = ET.fromstring('<node bounds="[30,350][290,470]"/>')
        analyze = ET.fromstring('<node bounds="[24,640][450,711]"/>')
        with patch.object(smoke, 'scroll_to', side_effect=[song,analyze]) as scroll, \
             patch.object(smoke, 'adb'), patch.object(smoke, 'find') as find, patch.object(smoke, 'tap'):
            smoke.open_cleaner_from_song('V5 Cleaner','V5 Proof')
            self.assertEqual(scroll.call_args_list[-1].args, ('tag-cleaner-analyze',))
            self.assertEqual(scroll.call_args_list[-1].kwargs, {'top':True})
            self.assertNotIn(('tag-cleaner-analyze',), [call.args for call in find.call_args_list])

    def test_matrix_requires_all_36_unique_cases_and_safe_touch_geometry(self):
        cases = [{'fontScale':scale,'appearance':appearance,'skin':skin,'density':density,
                  'playBounds':[12,250,350,390],'menuBounds':[350,270,422,342]}
                 for scale in ('1.0','1.3','2.0') for appearance in ('dark','light')
                 for skin in ('graphite','minimal','neon-cover') for density in ('standard','compact')]
        smoke.validate_matrix_coverage(cases)
        for changed in [cases[:-1], cases[:-1]+[cases[0]],
                        [{**cases[0],'menuBounds':[350,270,421,342]}]+cases[1:],
                        [{**cases[0],'playBounds':[12,250,360,390]}]+cases[1:]]:
            with self.assertRaises(AssertionError):
                smoke.validate_matrix_coverage(changed)

    def test_collection_waits_for_three_clean_frames_after_scan(self):
        busy = ET.fromstring('<hierarchy><node resource-id="library-import-status" bounds="[30,200][450,330]"/></hierarchy>')
        clean = self.header_frame()
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[busy,clean,clean,busy,clean,clean,clean]) as tree, \
             patch.object(smoke.time, 'sleep'):
            smoke.wait_collection_idle()
            self.assertEqual(tree.call_count,7)
            self.assertTrue((Path(directory)/'collection-idle.xml').exists())

    def test_persistent_scan_or_warning_cannot_reach_backup(self):
        busy = ET.fromstring('<hierarchy><node resource-id="library-import-status" bounds="[30,200][450,330]"/></hierarchy>')
        for frame in (busy, ET.fromstring('<hierarchy/>')):
            clock = iter(range(100))
            with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
                 patch.object(smoke, 'tree', return_value=frame), patch.object(smoke.time, 'sleep'), \
                 patch.object(smoke.time, 'monotonic', side_effect=lambda: next(clock)):
                with self.assertRaisesRegex(AssertionError, 'did not finish before backup'):
                    smoke.wait_collection_idle(timeout=5)
                self.assertTrue((Path(directory)/'collection-still-busy.xml').exists())

    def preparation_frame(self, stopped=False):
        root = self.header_frame()
        ET.SubElement(root,'node',{'resource-id':'library-waveform-preparation','bounds':'[30,210][450,330]'})
        if stopped:
            ET.SubElement(root,'node',{'text':'Waveformanalyse angehalten','bounds':'[50,220][300,290]'})
        else:
            ET.SubElement(root,'node',{'content-desc':'Waveformanalyse abbrechen','package':smoke.PACKAGE,'enabled':'true','bounds':'[320,220][422,292]'})
        return root

    def test_optional_preparation_cancels_once_then_requires_terminal_ack_before_restart(self):
        running, stopped = self.preparation_frame(), self.preparation_frame(stopped=True)
        with patch.object(smoke, 'CHECKS', []), patch.object(smoke, 'V5_PROOFS', {}), \
             patch.object(smoke, 'tree', side_effect=[running,running,stopped,stopped,stopped]), \
             patch.object(smoke, 'screenshot'), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'public_cold_start') as restart:
            smoke.quiesce_optional_preparation()
            tap.assert_called_once()
            self.assertEqual(tap.call_args.args[0].get('content-desc'),'Waveformanalyse abbrechen')
            restart.assert_called_once()

    def test_optional_preparation_without_ack_must_not_restart_or_bypass_scope(self):
        clock = iter(range(100))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'V5_PROOFS', {}), \
             patch.object(smoke, 'tree', return_value=self.preparation_frame()), \
             patch.object(smoke, 'screenshot'), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke.time, 'monotonic', side_effect=lambda:next(clock)), \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'public_cold_start') as restart:
            with self.assertRaisesRegex(AssertionError, 'did not acknowledge'):
                smoke.quiesce_optional_preparation(timeout=5)
            tap.assert_called_once()
            restart.assert_not_called()

    def test_picker_waits_for_system_package_and_never_taps_app_navigate_up(self):
        app = ET.fromstring(f'<hierarchy><node package="{smoke.PACKAGE}" content-desc="Navigate up" bounds="[0,36][84,120]"/></hierarchy>')
        docs = ET.fromstring('<hierarchy><node package="com.google.android.documentsui" text="sdk_gphone64_x86_64" enabled="true" resource-id="com.google.android.documentsui:id/breadcrumb_text" bounds="[0,108][275,180]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[app,app,docs]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tap:
            smoke.select_picker_storage()
            tap.assert_not_called()

    def test_picker_opens_only_system_roots_and_waits_for_storage_ack(self):
        docs = ET.fromstring('<hierarchy><node package="com.google.android.documentsui" content-desc="Show roots" enabled="true" bounds="[0,36][84,120]"/></hierarchy>')
        pending = ET.fromstring('<hierarchy/>')
        storage = ET.fromstring('<hierarchy><node package="com.google.android.documentsui" text="sdk_gphone64_x86_64" bounds="[20,200][300,272]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[docs,pending,storage]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tap:
            smoke.select_picker_storage()
            self.assertEqual(tap.call_count,2)
            self.assertTrue(all(call.args[0].get('package')=='com.google.android.documentsui' for call in tap.call_args_list))

    def test_android10_hidden_internal_storage_is_revealed_via_real_overflow(self):
        pkg='com.android.documentsui'
        initial=ET.fromstring(f'<hierarchy><node package="{pkg}" content-desc="Show roots" enabled="true" bounds="[12,48][96,120]"/></hierarchy>')
        drawer=ET.fromstring(f'<hierarchy><node package="{pkg}" text="Open from" bounds="[24,47][194,96]"/></hierarchy>')
        storage=ET.fromstring(f'<hierarchy><node package="{pkg}" text="Internal storage" bounds="[20,200][300,272]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[initial,drawer,initial,initial,storage]), patch.object(smoke.time,'sleep'), \
             patch.object(smoke,'tap_node') as tap, patch.object(smoke,'back') as back, patch.object(smoke,'reveal_internal_storage') as reveal:
            smoke.select_picker_storage()
            back.assert_called_once()
            reveal.assert_called_once_with(initial)
            self.assertEqual(tap.call_args.args[0].get('text'),'Internal storage')

    def test_android10_folder_access_requires_exact_requested_folder_and_system_owner(self):
        root=ET.fromstring('<hierarchy><node package="com.android.documentsui" text="ALLOW ACCESS TO &quot;K1W1SCANFIX&quot;" enabled="true" bounds="[21,816][459,888]"/></hierarchy>')
        self.assertIsNotNone(smoke.folder_access_button(root,'K1W1ScanFix'))
        self.assertIsNone(smoke.folder_access_button(root,'Other'))
        root[0].set('package',smoke.PACKAGE)
        self.assertIsNone(smoke.folder_access_button(root,'K1W1ScanFix'))

    def picker_trail_frame(self, current_root=False):
        pkg='com.google.android.documentsui'
        root=ET.Element('hierarchy')
        owner=ET.SubElement(root,'node',{'package':pkg,'resource-id':pkg+':id/horizontal_breadcrumb','enabled':'true','bounds':'[0,108][480,180]'})
        names=['sdk_gphone64_x86_64'] if current_root else ['sdk_gphone64_x86_64','Download','MusikBackup']
        for index,name in enumerate(names):
            item=ET.SubElement(owner,'node',{'package':pkg,'enabled':'true','clickable':'false','bounds':f'[{index*160},108][{(index+1)*160},180]'})
            ET.SubElement(item,'node',{'package':pkg,'resource-id':pkg+':id/breadcrumb_text','text':name,
                'enabled':'true' if index==len(names)-1 else 'false','bounds':f'[{index*160},108][{(index+1)*160-10},180]'})
        return root

    def test_picker_sdk_ancestor_is_not_current_root_and_requires_real_location_ack(self):
        nested=self.picker_trail_frame()
        top=self.picker_trail_frame(current_root=True)
        self.assertFalse(smoke.picker_at_internal_root(nested))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'tree',side_effect=[nested,nested,nested,top,top,top]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tap:
            smoke.select_picker_storage()
            tap.assert_called_once()
            self.assertEqual(smoke.rect(tap.call_args.args[0]),[0,108,160,180])
            self.assertTrue((Path(directory)/'picker-internal-root-ack.xml').exists())

    def test_picker_root_tap_without_location_ack_and_clipped_owner_still_fail(self):
        nested=self.picker_trail_frame()
        clock=iter(range(100))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'tree',return_value=nested), patch.object(smoke.time,'sleep'), \
             patch.object(smoke.time,'monotonic',side_effect=lambda:next(clock)), patch.object(smoke,'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError,'did not acknowledge'):
                smoke.navigate_picker_root(nested,timeout=5)
            tap.assert_called_once()
        clipped=self.picker_trail_frame()
        next(clipped.iter('node')).set('bounds','[10,108][480,180]')
        clock=iter(range(100))
        with patch.object(smoke,'tap_node') as tap, patch.object(smoke,'tree',return_value=clipped), \
             patch.object(smoke.time,'sleep'), patch.object(smoke.time,'monotonic',side_effect=lambda:next(clock)):
            with self.assertRaisesRegex(AssertionError,'clipped'):
                smoke.navigate_picker_root(clipped)
            tap.assert_not_called()

    def test_picker_root_geometry_must_settle_before_one_input(self):
        moving=self.picker_trail_frame()
        stable=self.picker_trail_frame()
        owner=next(stable.iter('node'))
        item=list(owner)[0]
        item.set('bounds','[0,108][200,180]')
        with patch.object(smoke,'tree',side_effect=[stable,stable,stable]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tap:
            selected,frame=smoke.settle_picker_root(moving)
            self.assertEqual(smoke.rect(selected),[0,108,200,180])
            tap.assert_not_called()

    def test_picker_root_waits_out_recorded_two_pixel_window_animation(self):
        moving=self.picker_trail_frame()
        owner=next(moving.iter('node'));owner.set('bounds','[8,108][480,180]')
        list(owner)[0].set('bounds','[6,108][169,180]')
        stable=self.picker_trail_frame()
        with patch.object(smoke,'tree',side_effect=[stable,stable,stable]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tap:
            selected,frame=smoke.settle_picker_root(moving)
            self.assertIs(frame,stable)
            self.assertEqual(smoke.rect(selected),[0,108,160,180])
            tap.assert_not_called()

    def test_permanently_clipped_picker_root_remains_a_bounded_failure_without_input(self):
        clipped=self.picker_trail_frame()
        next(clipped.iter('node')).set('bounds','[8,108][480,180]')
        clock=iter(range(100))
        with patch.object(smoke,'tree',return_value=clipped), patch.object(smoke.time,'sleep'), \
             patch.object(smoke.time,'monotonic',side_effect=lambda:next(clock)), patch.object(smoke,'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError,'clipped'):
                smoke.settle_picker_root(clipped,timeout=5)
            tap.assert_not_called()

    def test_cleaner_safe_queue_requires_real_native_size_after_restart(self):
        base=self.resume_session('PAUSED',0,1000,title=smoke.TITLES[0])
        smoke.validate_native_queue_size(base+'\nqueueTitle=null, size=2',smoke.TITLES[0],2)
        for session in (base+'\nqueueTitle=null, size=5',base,base.replace(smoke.TITLES[0],'V5 Cleaner')+'\nqueueTitle=null, size=2'):
            with self.assertRaises(AssertionError):
                smoke.validate_native_queue_size(session,smoke.TITLES[0],2)

    def clipped_menu_frame(self, bounds):
        return ET.fromstring(f'<hierarchy><node package="{smoke.PACKAGE}" class="android.widget.ScrollView" scrollable="true" bounds="[0,229][480,742]"><node package="{smoke.PACKAGE}" resource-id="song-card-info-track" bounds="{bounds}"/></node></hierarchy>')

    def test_native_menu_rect_clipped_at_parent_edge_is_not_full_touch_area(self):
        clipped=self.clipped_menu_frame('[380,739][452,742]')
        self.assertIsNone(smoke.scroll_candidate('song-card-info-track',clipped))
        full=self.clipped_menu_frame('[380,602][452,674]')
        self.assertIsNotNone(smoke.scroll_candidate('song-card-info-track',full))
        undersized=self.clipped_menu_frame('[380,500][452,550]')
        self.assertIsNotNone(smoke.scroll_candidate('song-card-info-track',undersized))
        # A genuinely small interior control must still reach the unchanged 48dp assertion.

    def test_obscured_input_uses_only_the_visible_keyboard_dismiss_button(self):
        root = ET.fromstring('<hierarchy><node resource-id="android:id/input_method_nav_back" package="com.google.android.inputmethod.latin" enabled="true" bounds="[21,888][204,960]"/></hierarchy>')
        field = ET.fromstring('<node text="SwipeProbe" focused="true"/>')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=root), patch.object(smoke, 'find', return_value=field) as find, \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'back') as back:
            self.assertIs(smoke.reveal_public_input('library-playlist-name-input'), field)
            self.assertEqual(tap.call_args.args[0].get('package'), 'com.google.android.inputmethod.latin')
            tap.assert_called_once()
            find.assert_called_once_with('library-playlist-name-input')
            back.assert_not_called()

    def test_obscured_input_rejects_app_back_and_ambiguous_keyboard_buttons(self):
        for packages in [(smoke.PACKAGE,), ('com.google.android.inputmethod.latin',)*2, ()]:
            root = ET.Element('hierarchy')
            for package in packages:
                ET.SubElement(root, 'node', {'resource-id':'android:id/input_method_nav_back',
                    'package':package,'enabled':'true','bounds':'[21,888][204,960]'})
            with patch.object(smoke, 'tree', return_value=root), patch.object(smoke, 'tap_node') as tap:
                with self.assertRaisesRegex(AssertionError, 'no unique public keyboard'):
                    smoke.reveal_public_input('library-playlist-name-input')
                tap.assert_not_called()

    def input_frame(self, bounds='[36,636][272,707]', focused='false'):
        return ET.fromstring(f'<hierarchy><node resource-id="library-playlist-name-input" package="{smoke.PACKAGE}" enabled="true" focused="{focused}" bounds="{bounds}"/></hierarchy>')

    def test_public_input_waits_for_reflow_and_native_focus_before_typing(self):
        moving = self.input_frame('[36,436][272,507]')
        stable = self.input_frame()
        focused = self.input_frame(focused='true')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[moving,stable,stable,stable,focused]), \
             patch.object(smoke.time, 'sleep'), patch.object(smoke, 'tap_node') as tap:
            self.assertEqual(smoke.focus_public_input('library-playlist-name-input').get('focused'), 'true')
            self.assertEqual(smoke.rect(tap.call_args.args[0]), [36,636,272,707])
            tap.assert_called_once()

    def test_public_input_does_not_accept_or_retry_a_missed_focus_tap(self):
        clock = iter(range(100))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=self.input_frame()), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke.time, 'monotonic', side_effect=lambda: next(clock)), patch.object(smoke, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'did not acknowledge focus'):
                smoke.focus_public_input('library-playlist-name-input')
            tap.assert_called_once()

    def swipe_frame(self, bounds='[0,306][480,585]', overlay=False):
        root = ET.fromstring(f'<hierarchy><node resource-id="soundcloud-swipe-hitbox" package="{smoke.PACKAGE}" enabled="true" bounds="{bounds}"/></hierarchy>')
        if overlay:
            ET.SubElement(root, 'node', {'resource-id':'soundcloud-queue-close','bounds':'[400,100][460,170]'})
        return root

    def test_cover_swipe_requires_settled_uncovered_geometry_and_exact_native_ack(self):
        moving = self.swipe_frame('[0,286][480,565]', overlay=True)
        stable = self.swipe_frame()
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[moving,stable,stable,stable]), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'app_media_session', return_value='owned baseline'), \
             patch.object(smoke, 'adb') as adb, patch.object(smoke, 'wait_playing_session') as ack:
            smoke.perform_public_cover_swipe(smoke.TITLES[0])
            adb.assert_called_once_with('shell','input','swipe','72','445','408','445','600')
            ack.assert_called_once_with(smoke.TITLES[0])

    def test_cover_swipe_does_not_retry_or_accept_a_wrong_native_track(self):
        stable = self.swipe_frame()
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=stable), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'app_media_session', return_value='owned baseline'), patch.object(smoke, 'adb') as adb, \
             patch.object(smoke, 'wait_playing_session', side_effect=AssertionError('another track')):
            with self.assertRaisesRegex(AssertionError, 'another track'):
                smoke.perform_public_cover_swipe(smoke.TITLES[0])
            adb.assert_called_once()

    def indexed_fixture_rows(self):
        names = ('V3-0.mp3', 'V3-1.m4a', 'V3-2.flac', 'V3-3.mp3')
        return '\n'.join(f'Row: {i} _id={i+1}, _display_name={name}, title={title}, duration=90000, is_music=1'
                         for i, (name, title) in enumerate(zip(names, smoke.TITLES)))

    def test_fixture_media_store_requires_all_four_unique_indexed_audio_rows(self):
        ready = self.indexed_fixture_rows()
        self.assertTrue(smoke.fixture_media_store_ready(ready))
        for bad in ('No result found.', '\n'.join(ready.splitlines()[:3]),
                    ready.replace('duration=90000', 'duration=0', 1),
                    ready.replace('is_music=1', 'is_music=0', 1),
                    ready.replace(smoke.TITLES[0], 'Wrong metadata'),
                    ready + '\n' + ready.splitlines()[0]):
            self.assertFalse(smoke.fixture_media_store_ready(bad))

    def test_fixture_media_store_wait_is_read_only_and_does_not_accept_pending_rows(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'adb', side_effect=[b'No result found.', self.indexed_fixture_rows().encode()]) as adb, \
             patch.object(smoke.time, 'monotonic', side_effect=[0,0,1]), patch.object(smoke.time, 'sleep'):
            smoke.wait_for_fixture_media_store()
            self.assertEqual(adb.call_count, 2)
            self.assertTrue(all(call.args[:3] == ('shell','content','query') for call in adb.call_args_list))

    def test_fixture_media_store_deadline_fails_before_app_import(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'adb', return_value=b'No result found.'), \
             patch.object(smoke.time, 'monotonic', side_effect=[0,0,121]), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(AssertionError, 'registration did not complete'):
                smoke.wait_for_fixture_media_store()

    def test_scroll_checks_full_target_even_when_compact_owner_is_present(self):
        compact = self.scroll_frame()
        full = self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', side_effect=[compact,full]) as tree, patch.object(smoke, 'adb') as adb:
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('content-desc'), 'Wanted')
            tree.assert_called_with(compressed=False)
            adb.assert_not_called()

    def test_full_target_lookup_keeps_parent_clipping_assertion(self):
        compact = self.scroll_frame()
        full = self.scroll_frame(target=True)
        target = next(n for n in full.iter('node') if n.get('content-desc') == 'Wanted')
        target.set('bounds', '[30,900][430,950]')
        with patch.object(smoke, 'tree', side_effect=[compact,full]):
            frame = smoke.scroll_query_frame('Wanted')
            self.assertIsNone(smoke.scroll_candidate('Wanted', frame))

    def test_scroll_falls_back_to_full_topology_before_touching_a_pruned_surface(self):
        compact = ET.fromstring('<hierarchy><node class="android.widget.HorizontalScrollView" scrollable="true" bounds="[0,137][480,195]"/></hierarchy>')
        full = self.scroll_frame('[12,491][468,742]')
        found = self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', side_effect=[compact, full, found]) as tree, \
             patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('content-desc'), 'Wanted')
            tree.assert_any_call(compressed=False)
            adb.assert_called_once_with('shell','input','swipe','240','705','240','528','300')

    def test_full_scroll_fallback_rejects_missing_or_ambiguous_owners(self):
        missing = ET.fromstring('<hierarchy/>')
        ambiguous = ET.fromstring('<hierarchy><node scrollable="true" bounds="[0,100][480,400]"/>'
                                 '<node scrollable="true" bounds="[0,500][480,800]"/></hierarchy>')
        for full in (missing, ambiguous):
            with patch.object(smoke, 'tree', side_effect=[missing, full]), patch.object(smoke, 'adb') as adb:
                with self.assertRaises(AssertionError):
                    smoke.scroll_to('Wanted', limit=1)
                adb.assert_not_called()

    def tab_frame(self, bounds='[223,137][329,195]', selected='false'):
        return ET.fromstring(f'<hierarchy><node resource-id="library-tabs" bounds="[0,137][480,195]">'
            f'<node resource-id="library-tab-playlists" package="{smoke.PACKAGE}" enabled="true"'
            f' selected="{selected}" bounds="{bounds}"/></node></hierarchy>')

    def test_library_tab_waits_for_stable_geometry_and_native_selection(self):
        moving = self.tab_frame('[223,157][329,215]')
        stable = self.tab_frame()
        selected = self.tab_frame(selected='true')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[moving, stable, stable, stable, selected, selected]), \
             patch.object(smoke.time, 'sleep'), patch.object(smoke, 'tap_node') as tap:
            smoke.library_tab('playlists')
            self.assertEqual(smoke.rect(tap.call_args.args[0]), [223,137,329,195])
            tap.assert_called_once()

    def test_library_tab_does_not_treat_a_sent_tap_as_a_selected_tab(self):
        clock = iter(range(100))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=self.tab_frame()), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke.time, 'monotonic', side_effect=lambda: next(clock)), patch.object(smoke, 'tap_node') as tap:
            with self.assertRaisesRegex(AssertionError, 'selection was not acknowledged'):
                smoke.library_tab('playlists')
            tap.assert_called_once()

    def test_already_selected_library_tab_is_confirmed_without_an_extra_tap(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=self.tab_frame(selected='true')), \
             patch.object(smoke.time, 'sleep'), patch.object(smoke, 'tap_node') as tap:
            smoke.library_tab('playlists')
            tap.assert_not_called()

    def add_modal(self, bounds, package=smoke.PACKAGE, scrollable='true'):
        return ET.fromstring(f'<hierarchy><node resource-id="playlist-detail-add-list" scrollable="{scrollable}" class="android.widget.ScrollView" bounds="[10,200][470,650]">'
            f'<node resource-id="playlist-detail-add-song-first" package="{package}" enabled="true"'
            f' content-desc="{smoke.TITLES[0]} zur Playlist hinzufügen" bounds="{bounds}"/></node></hierarchy>')

    def test_playlist_add_waits_for_modal_reflow_and_requires_membership_ack(self):
        moving = self.add_modal('[320,250][455,310]')
        stable = self.add_modal('[320,350][455,410]')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[moving, stable, stable, stable, ET.fromstring('<hierarchy/>')]), \
             patch.object(smoke, 'scroll_to'), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'PLAYLIST_ADD_PROOFS', []):
            smoke.add_public_playlist_songs([smoke.TITLES[0]])
            self.assertEqual(smoke.rect(tap.call_args.args[0]), [320, 350, 455, 410])
            tap.assert_called_once()
            proof = json.loads((Path(directory) / 'playlist-add-proofs.json').read_text())[0]
            self.assertEqual(proof['ack'], 'candidate-removed')
            self.assertNotEqual(proof['geometrySamples'][0], proof['stableBounds'])

    def test_playlist_add_does_not_accept_a_missed_tap_or_retry_it(self):
        stable = self.add_modal('[320,350][455,410]')
        clock = iter(range(100))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', return_value=stable), patch.object(smoke, 'scroll_to'), \
             patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=lambda: next(clock)), \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'PLAYLIST_ADD_PROOFS', []):
            with self.assertRaisesRegex(AssertionError, 'addition was not acknowledged'):
                smoke.add_public_playlist_songs([smoke.TITLES[0]])
            tap.assert_called_once()
            proof = json.loads((Path(directory) / 'playlist-add-proofs.json').read_text())[0]
            self.assertEqual(proof['ack'], 'not-yet-confirmed')

    def test_playlist_add_rejects_clipped_or_foreign_actions(self):
        for frame in (self.add_modal('[320,630][455,690]'), self.add_modal('[320,350][455,410]', 'other.app')):
            clock = iter(range(100))
            with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
                 patch.object(smoke, 'tree', return_value=frame), patch.object(smoke, 'scroll_to'), \
                 patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=lambda: next(clock)), \
                 patch.object(smoke, 'tap_node') as tap:
                with self.assertRaises(AssertionError):
                    smoke.add_public_playlist_songs([smoke.TITLES[0]])
                tap.assert_not_called()

    def test_playlist_add_accepts_a_fitting_list_without_faking_scrollability(self):
        stable = self.add_modal('[320,350][455,410]', scrollable='false')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[stable, stable, stable, ET.fromstring('<hierarchy/>')]), \
             patch.object(smoke, 'scroll_to'), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'tap_node') as tap, patch.object(smoke, 'PLAYLIST_ADD_PROOFS', []):
            smoke.add_public_playlist_songs([smoke.TITLES[0]])
            tap.assert_called_once()

    def test_transport_recovery_is_once_same_boot_and_never_restarts_app(self):
        original = Mock()
        original.dump_hierarchy.side_effect = json.JSONDecodeError('empty HTTP response', '', 0)
        restored = Mock()
        restored.dump_hierarchy.return_value = '<hierarchy/>'
        connector = Mock(connect=Mock(return_value=restored))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'DEVICE', original), patch.object(smoke, 'DEVICE_SERIAL', 'emulator-5554'), \
             patch.object(smoke, 'DEVICE_BOOT_ID', 'same-boot'), patch.object(smoke, 'TRANSPORT_RECOVERIES', []), \
             patch.object(smoke, 'adb', side_effect=[b'', b'same-boot', b'no crash']) as adb, \
             patch.dict('sys.modules', {'uiautomator2': connector}):
            self.assertEqual(smoke.dump_hierarchy(True), '<hierarchy/>')
            connector.connect.assert_called_once_with('emulator-5554')
            adb.assert_any_call('-s', 'emulator-5554', 'wait-for-device', timeout=30)
            self.assertFalse(any('force-stop' in call.args or 'install' in call.args for call in adb.call_args_list))
            proof = json.loads((Path(directory) / 'transport-recovery.json').read_text())
            self.assertEqual(proof[0]['status'], 'recovered-same-boot-no-app-restart')
            restored.dump_hierarchy.side_effect = json.JSONDecodeError('second loss', '', 0)
            with self.assertRaises(json.JSONDecodeError):
                smoke.dump_hierarchy(True)
            connector.connect.assert_called_once()

    def test_transport_recovery_rejects_reboot_or_runtime_failure(self):
        for boot, logs in [('different-boot', b'no crash'), ('same-boot', b'FATAL EXCEPTION: main'),
                           ('same-boot', ('ANR in ' + smoke.PACKAGE).encode())]:
            device = Mock()
            device.dump_hierarchy.side_effect = json.JSONDecodeError('empty response', '', 0)
            connector = Mock()
            with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
                 patch.object(smoke, 'DEVICE', device), patch.object(smoke, 'DEVICE_SERIAL', 'emulator-5554'), \
                 patch.object(smoke, 'DEVICE_BOOT_ID', 'same-boot'), patch.object(smoke, 'TRANSPORT_RECOVERIES', []), \
                 patch.object(smoke, 'adb', side_effect=[b'', boot.encode(), logs]), \
                 patch.dict('sys.modules', {'uiautomator2': connector}):
                with self.assertRaises(AssertionError):
                    smoke.dump_hierarchy(True)
                connector.connect.assert_not_called()

    def test_ui_assertions_are_not_transport_failures(self):
        device = Mock()
        device.dump_hierarchy.side_effect = AssertionError('UI not reachable')
        with patch.object(smoke, 'DEVICE', device), patch.object(smoke, 'adb') as adb:
            with self.assertRaisesRegex(AssertionError, 'UI not reachable'):
                smoke.dump_hierarchy(True)
            adb.assert_not_called()

    def test_transport_reconnection_deadline_remains_a_failure(self):
        device = Mock()
        device.dump_hierarchy.side_effect = json.JSONDecodeError('empty response', '', 0)
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'DEVICE', device), patch.object(smoke, 'DEVICE_SERIAL', 'emulator-5554'), \
             patch.object(smoke, 'DEVICE_BOOT_ID', 'same-boot'), patch.object(smoke, 'TRANSPORT_RECOVERIES', []), \
             patch.object(smoke, 'adb', side_effect=subprocess.TimeoutExpired('adb wait-for-device', 30)):
            with self.assertRaises(subprocess.TimeoutExpired):
                smoke.dump_hierarchy(True)

    def test_adb_commands_have_finite_response_budgets(self):
        with patch.object(smoke.subprocess, 'run', return_value=Mock(stdout=b'ok')) as run:
            smoke.adb('shell', 'input', 'tap', '1', '2')
            self.assertEqual(run.call_args.kwargs['timeout'], 30)
            smoke.adb('install', '-r', 'fixture.apk', timeout=180)
            self.assertEqual(run.call_args.kwargs['timeout'], 180)

    def test_malformed_xml_is_not_accepted_as_a_transport_recovery(self):
        device = Mock()
        device.dump_hierarchy.return_value = 'not XML'
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'DEVICE', device), patch.object(smoke, 'TRANSPORT_RECOVERIES', []):
            with self.assertRaises(ET.ParseError):
                smoke.tree()
            self.assertEqual(smoke.TRANSPORT_RECOVERIES, [])

    def test_release_replacement_requires_two_native_queues_and_real_playback(self):
        root = ET.Element('hierarchy')
        ET.SubElement(root, 'node', {'resource-id': 'playlist-detail-song-one',
            'content-desc': smoke.TITLES[0] + ' von V3 Proof abspielen. Position 1 von 2',
            'bounds': '[20,300][400,400]'})
        with patch.object(smoke, 'tree', return_value=root), patch.object(smoke, 'tap_node'), \
             patch.object(smoke, 'wait_playing_session'), patch.object(smoke, 'find'), \
             patch.object(smoke, 'tap'), patch.object(smoke, 'back'), patch.object(smoke, 'library_tab'), \
             patch.object(smoke, 'play_title') as play, patch.object(smoke, 'assert_duration') as duration, \
             patch.object(smoke, 'assert_native_playback') as playback, \
             patch.object(smoke, 'queue_probe_snapshot') as queue:
            smoke.playlist_to_library_replacement('acceptance', 5)
            self.assertEqual(queue.call_args_list, [unittest.mock.call('acceptance-paused-two', 2),
                unittest.mock.call('acceptance-selected-library', 5), unittest.mock.call('acceptance-playing-library', 5)])
            self.assertEqual(playback.call_args_list, [unittest.mock.call(smoke.TITLES[0], 90),
                unittest.mock.call(smoke.TITLES[1], 120)])
            play.assert_called_once_with(smoke.TITLES[1])
            duration.assert_called_once_with(120)
            root.clear()
            with self.assertRaises(AssertionError):
                smoke.playlist_to_library_replacement('missing', 5)

    def test_playlist_creation_uses_public_done_action_without_back_navigation(self):
        field = ET.fromstring('<node text="QueueProbe" focused="true" bounds="[28,300][380,360]"/>')
        with patch.object(smoke, 'tap'), patch.object(smoke, 'focus_public_input'), patch.object(smoke, 'reveal_public_input', return_value=field), patch.object(smoke, 'find', return_value=field) as find, \
             patch.object(smoke, 'tap_node'), patch.object(smoke, 'adb') as adb, patch.object(smoke, 'back') as back:
            smoke.create_public_playlist('QueueProbe')
            adb.assert_any_call('shell', 'input', 'text', 'QueueProbe')
            adb.assert_any_call('shell', 'input', 'keyevent', '66')
            find.assert_any_call('Playlist QueueProbe')
            back.assert_not_called()
            field.set('text', 'lost characters')
            adb.reset_mock()
            with self.assertRaises(AssertionError):
                smoke.create_public_playlist('QueueProbe')
            self.assertNotIn(unittest.mock.call('shell', 'input', 'keyevent', '66'), adb.call_args_list)

    def test_queue_probe_requires_the_actual_native_queue_size(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'screenshot'), patch.object(smoke, 'adb', return_value=b'fixture notifications'):
            for count in (0, 2, 3, 4):
                session = f'package={smoke.PACKAGE}\nqueueTitle=null, size={count}'
                with patch.object(smoke, 'app_media_session', return_value=session):
                    if count == 2:
                        smoke.queue_probe_snapshot('paused-two', 2)
                        self.assertEqual((Path(directory) / 'paused-two-session.txt').read_text(), session)
                    else:
                        with self.assertRaises(AssertionError):
                            smoke.queue_probe_snapshot('paused-two', 2)

    def resume_dialog(self):
        return ET.fromstring(f'<hierarchy><node package="{smoke.PACKAGE}" text="Wiedergabe fortsetzen?"/>'
                             f'<node package="{smoke.PACKAGE}" resource-id="android:id/button1" text="FORTSETZEN" enabled="true" bounds="[260,448][426,520]"/></hierarchy>')

    def test_resume_flow_selects_the_observed_uppercase_positive_action(self):
        dialog = self.resume_dialog()
        class ReachedConfirmation(Exception):
            pass
        def tap(key):
            if key == 'Fortsetzen':
                raise AssertionError('Android exposes FORTSETZEN, not the JS source spelling')
        def confirm(node):
            self.assertEqual(node.get('resource-id'), 'android:id/button1')
            self.assertEqual(node.get('text'), 'FORTSETZEN')
            raise ReachedConfirmation()
        with patch.object(smoke, 'settings'), patch.object(smoke, 'checkbox'), \
             patch.object(smoke, 'back'), patch.object(smoke, 'play_title'), \
             patch.object(smoke, 'assert_duration'), patch.object(smoke, 'find', return_value=ET.fromstring('<node bounds="[21,548][459,635]"/>')), \
             patch.object(smoke, 'adb'), patch.object(smoke.time, 'sleep'), \
             patch.object(smoke, 'classic_position', return_value=259), \
             patch.object(smoke, 'screenshot'), patch.object(smoke, 'tree', return_value=dialog), \
             patch.object(smoke, 'tap', side_effect=tap), patch.object(smoke, 'tap_node', side_effect=confirm):
            with self.assertRaises(ReachedConfirmation):
                smoke.resume_acceptance()

    def test_cleaner_import_below_viewport_reaches_real_selection_before_analysis(self):
        class ReachedAnalysis(Exception):
            pass
        def find(key, **kwargs):
            if key == 'V5 Cleaner von V5 Proof':
                raise AssertionError('Imported cleaner row is below viewport')
            if key == 'tag-cleaner-analyze':
                raise ReachedAnalysis()
        def scroll_target(key, **kwargs):
            if key == 'tag-cleaner-analyze':
                raise ReachedAnalysis()
            return ET.fromstring('<node bounds="[28,520][290,603]"/>')
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / 'synthetic.mp3'
            fixture.write_bytes(b'synthetic original')
            with patch.object(smoke, 'dirty_cleaner_fixture', return_value=fixture), \
                 patch.object(smoke, 'adb'), patch.object(smoke, 'tap'), \
                 patch.object(smoke, 'choose_folder'), patch.object(smoke, 'find', side_effect=find), \
                 patch.object(smoke, 'select_cleaner_safe_playback_queue'), \
                 patch.object(smoke, 'wait_collection_idle'), patch.object(smoke, 'quiesce_optional_preparation'), \
                 patch.object(smoke, 'scroll_to', side_effect=scroll_target) as scroll:
                with self.assertRaises(ReachedAnalysis):
                    smoke.cleaner_acceptance()
                self.assertEqual([(call.args,call.kwargs) for call in scroll.call_args_list],
                                 [(('V5 Cleaner von V5 Proof',),{'top':True}),
                                  (('tag-cleaner-analyze',),{'top':True})])
                self.assertEqual(fixture.read_bytes(), b'synthetic original')

    def test_cleaner_font2_is_configured_before_reentry_not_during_the_file_preview(self):
        class ReachedFileApply(Exception):
            pass
        state={'font':'1.0','route':'library'}
        events=[]
        original=b'synthetic original; no native write in this control-flow test'
        def adb(*args,**kwargs):
            if args[:5]==('shell','settings','put','system','font_scale'):
                state.update(font=args[5],route='library')  # observed Android activity recreation
                events.append(('font',args[5]))
            if args[0]=='pull':
                target=Path(args[2]);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(original)
            return b''
        def restart():
            state['route']='library';events.append(('restart',state['font']))
        def open_cleaner(*args):
            state['route']='cleaner';events.append(('open',state['font']))
        def apply(mode):
            self.assertEqual(state['route'],'cleaner','Font-scale change discarded the active preview')
            events.append(('apply-'+mode,state['font']))
            if mode=='file':
                self.assertEqual(state['font'],'2.0')
                raise ReachedFileApply()
        def target(key,**kwargs):
            return ET.Element('node',{'package':smoke.PACKAGE,'enabled':'false','text':key})
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);fixture=root/'synthetic.mp3';fixture.write_bytes(original)
            with patch.object(smoke,'OUT',root),patch.object(smoke,'dirty_cleaner_fixture',return_value=fixture), \
                 patch.object(smoke,'adb',side_effect=adb),patch.object(smoke,'tap'),patch.object(smoke,'choose_folder'), \
                 patch.object(smoke,'wait_collection_idle'),patch.object(smoke,'quiesce_optional_preparation'), \
                 patch.object(smoke,'select_cleaner_safe_playback_queue'),patch.object(smoke,'open_cleaner_from_song',side_effect=open_cleaner), \
                 patch.object(smoke,'select'),patch.object(smoke,'scroll_to',side_effect=target),patch.object(smoke,'wait_cleaner_preview_tools'), \
                 patch.object(smoke,'screenshot'),patch.object(smoke,'cleaner_apply_dialog',side_effect=apply), \
                 patch.object(smoke,'public_cold_start',side_effect=restart),patch.object(smoke,'library_tab'), \
                 patch.object(smoke,'app_media_session',return_value='native session fixture'),patch.object(smoke,'validate_native_queue_size'):
                with self.assertRaises(ReachedFileApply):smoke.cleaner_acceptance()
        self.assertEqual(events,[('open','1.0'),('apply-display','1.0'),('font','2.0'),('restart','2.0'),('open','2.0'),('apply-file','2.0')])

    def test_resume_confirmation_rejects_other_dialogs_actions_owners_and_disabled_buttons(self):
        root = self.resume_dialog()
        self.assertEqual(smoke.resume_confirmation_button(root).get('text'), 'FORTSETZEN')
        for index, attribute, value in [(0, 'text', 'Backup gespeichert'), (0, 'package', 'other.app'),
                                         (1, 'text', 'VON VORN'), (1, 'enabled', 'false'),
                                         (1, 'resource-id', 'android:id/button2'), (1, 'package', 'other.app')]:
            changed = self.resume_dialog()
            list(changed.iter('node'))[index].set(attribute, value)
            with self.assertRaises(AssertionError):
                smoke.resume_confirmation_button(changed)

    def test_resume_position_uses_actual_elapsed_time_and_rejects_stall_reset_or_jump(self):
        smoke.validate_resumed_position(259, 279, 20)
        smoke.validate_resumed_position(259, 269, 10.5)
        for position, elapsed in [(259, 20), (20, 20), (300, 20), (270, 20), (279, -1)]:
            with self.assertRaises(AssertionError):
                smoke.validate_resumed_position(259, position, elapsed)

    def resume_session(self, state, position, updated, title=None, speed=None):
        if speed is None:
            speed = 1.0 if state == 'PLAYING' else 0.0
        return (f'package={smoke.PACKAGE}\nmetadata: size=5, description={title or smoke.TITLES[3]}, V3 Proof\n'
                f'state=PlaybackState {{state={state}({3 if state == "PLAYING" else 2}), '
                f'position={position}, buffered position=524225, speed={speed}, updated={updated}}}')

    def test_resume_uses_android_clock_and_paused_ui_despite_slow_rpc(self):
        resumed = self.resume_session('PLAYING', 259000, 538815)
        paused = self.resume_session('PAUSED', 276686, 556876)
        # Real failing artifact: 273 was an earlier frame; host RPC returned later.
        # The paused frame now matches the actual native endpoint on Android.
        proof = smoke.validate_resume_clock(259, resumed, paused, 276, smoke.TITLES[3])
        self.assertAlmostEqual(proof['nativeElapsedSeconds'], 18.061)
        self.assertAlmostEqual(proof['pausedSeconds'], 276.686)

    def test_resume_native_clock_rejects_wrong_seek_stall_jump_clock_and_stale_ui(self):
        resumed = self.resume_session('PLAYING', 259000, 538815)
        good = self.resume_session('PAUSED', 276686, 556876)
        for initial, final, ui in [
            (self.resume_session('PLAYING', 1000, 538815), good, 276),
            (resumed, self.resume_session('PAUSED', 259000, 556876), 259),
            (resumed, self.resume_session('PAUSED', 320000, 556876), 320),
            (resumed, self.resume_session('PAUSED', 276686, 537000), 276),
            (resumed, good, 259),
            (self.resume_session('PLAYING', 259000, 538815, title='Another track'), good, 276),
            (self.resume_session('PLAYING', 259000, 538815, speed=0), good, 276),
        ]:
            with self.subTest(initial=initial, final=final, ui=ui), self.assertRaises(AssertionError):
                smoke.validate_resume_clock(259, initial, final, ui, smoke.TITLES[3])

    def test_saf_import_below_viewport_must_scroll_and_prove_native_playback(self):
        row = ET.fromstring('<node bounds="[28,520][290,603]"/>')
        class ReachedSafProof(Exception):
            pass
        def visible_find(key, **kwargs):
            if key == 'V3 SAF von V3 Proof':
                raise AssertionError('Imported SAF row is below the measured viewport')
            return row
        def native_proof(title, duration):
            if title == 'V3 SAF':
                self.assertEqual(duration, 80)
                raise ReachedSafProof()
        with patch.object(smoke, 'find', side_effect=visible_find), \
             patch.object(smoke, 'tap'), patch.object(smoke, 'tap_node'), \
             patch.object(smoke, 'back'), patch.object(smoke, 'screenshot'), \
             patch.object(smoke, 'tree'), patch.object(smoke, 'import_confirmation_button'), \
             patch.object(smoke, 'wait_collection_idle'), \
             patch.object(smoke, 'wait_uncovered_library_header', return_value=self.header_frame()), \
             patch.object(smoke, 'choose_folder'), patch.object(smoke, 'adb', return_value=b''), \
             patch.object(smoke.subprocess, 'run'), patch.object(smoke, 'assert_duration') as duration, \
             patch.object(smoke, 'scroll_to', return_value=row) as scroll, \
             patch.object(smoke, 'wait_selected_session') as selected, \
             patch.object(smoke, 'assert_native_playback', side_effect=native_proof):
            with self.assertRaises(ReachedSafProof):
                smoke.prepare_collection()
            scroll.assert_any_call('V3 SAF von V3 Proof', top=True)
            selected.assert_any_call('V3 SAF')
            duration.assert_any_call(80)

    def test_refuses_physical_devices_and_wrong_artifact_source_or_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'preview.apk'
            apk.write_bytes(b'fixture')
            sha = hashlib.sha256(b'fixture').hexdigest()
            commit = 'a' * 40
            validate_target(apk, sha, commit, commit, '1\n')
            for emulator, source, checksum in [('0', commit, sha), ('', commit, sha),
                                               ('1', 'b' * 40, sha), ('1', commit, '0' * 64)]:
                with self.assertRaises(AssertionError):
                    validate_target(apk, checksum, commit, source, emulator)
            with self.assertRaises(AssertionError):
                validate_target(apk, sha, 'codex', 'codex', '1')

    def test_requires_a_real_touch_rectangle_and_exact_identifiers(self):
        node = ET.fromstring('<node bounds="[12,20][84,92]" resource-id="app:id/backup-create"/>')
        self.assertEqual(rect(node), [12, 20, 84, 92])
        self.assertTrue(matches(node, 'backup-create'))
        self.assertFalse(matches(node, 'backup'))
        with self.assertRaises(AssertionError):
            rect(ET.fromstring('<node bounds="[0,0][0,0]"/>'))

    def source_jobs(self):
        return [{'name':name,'head_sha':'a'*40,'status':'completed','conclusion':'success'}
                for name in ('Dependency security audit',
                             'Typecheck, tests, coverage, lint, config gates',
                             'Android native build and tests')]

    def test_retest_allows_only_test_documentation_changes(self):
        jobs = self.source_jobs()
        validate_retest_provenance('a'*40, ['scripts/ci/androidReleaseInteractionSmoke.py'], jobs)
        validate_retest_provenance('a'*40, ['docs/CODEX-V5-CHECKPOINTS.md'], jobs)
        for path in ('App.tsx','package-lock.json','modules/expo-system-audio/android/build.gradle',
                     '.github/workflows/ci.yml', 'docs/unreviewed-script.py'):
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [path], jobs)

    def test_retest_rejects_failed_pending_missing_duplicate_or_other_source_gates(self):
        for field, value in [('conclusion','failure'),('status','in_progress'),('head_sha','b'*40)]:
            jobs = self.source_jobs()
            jobs[2][field] = value
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [], jobs)
        for jobs in (self.source_jobs()[:2], self.source_jobs()+[self.source_jobs()[0]]):
            with self.assertRaises(AssertionError):
                validate_retest_provenance('a'*40, [], jobs)

    def test_import_confirmation_matches_the_observed_public_dialog(self):
        root = ET.fromstring('<hierarchy><node text="Musik importieren"/>'
                             '<node resource-id="android:id/button1" text="IMPORTIEREN" bounds="[267,542][438,614]"/></hierarchy>')
        self.assertEqual(rect(import_confirmation_button(root)), [267,542,438,614])

    def test_never_confirms_an_unrelated_dialog_or_button(self):
        for title, action in [('Backup gespeichert','IMPORTIEREN'),('Musik importieren','LÖSCHEN')]:
            root = ET.fromstring(f'<hierarchy><node text="{title}"/>'
                                  f'<node resource-id="android:id/button1" text="{action}"/></hierarchy>')
            with self.assertRaises(AssertionError):
                import_confirmation_button(root)

    def test_format_fixtures_exceed_the_enabled_music_filter(self):
        self.assertTrue(all(duration > 45 for duration in FORMAT_DURATIONS))

    def test_closes_only_the_identified_pixel_launcher_system_dialog(self):
        root = ET.fromstring('<hierarchy><node resource-id="android:id/alertTitle" text="Pixel Launcher isn\'t responding"/>'
                             '<node resource-id="android:id/aerr_close" text="Close app"/></hierarchy>')
        self.assertIsNotNone(pixel_launcher_close_button(root))
        for title in ("k1w1-Musik isn't responding", "System UI isn't responding", 'Musik importieren'):
            root = ET.fromstring(f'<hierarchy><node resource-id="android:id/alertTitle" text="{title}"/>'
                                  '<node resource-id="android:id/aerr_close" text="Close app"/></hierarchy>')
            self.assertIsNone(pixel_launcher_close_button(root))

    def test_decoded_time_excludes_system_clock_and_song_metadata_labels(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="10:34"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:42"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:29"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:30 • MP3 • 32 kbps"/></hierarchy>')
        self.assertEqual(app_time_values(root), [42,89])

    def test_time_parser_matches_native_hours_and_rejects_invalid_components(self):
        self.assertEqual(time_seconds('1:01:01'), 3661)
        self.assertEqual(time_seconds('21:00'), 1260)
        self.assertEqual(time_seconds('0:00'), 0)
        for label in ('1:60', '1:60:00', '90 seconds', '1:30 • MP3', '-1:01'):
            with self.assertRaises(AssertionError):
                time_seconds(label)

    def test_classic_timeline_reads_slider_sibling_times_and_ignores_background(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="1:30"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:01"/>'
                             '<node><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[21,548][459,635]"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="0:42"/>'
                             '<node package="com.k1w1a0style.musikplayer" text="1:29"/></node></hierarchy>')
        self.assertEqual(timeline_values(root), (42,89))

    def test_soundcloud_total_is_not_confused_with_elapsed_or_system_clock(self):
        root = ET.fromstring('<hierarchy><node package="com.android.systemui" text="1:30"/>'
                             '<node package="com.k1w1a0style.musikplayer" resource-id="soundcloud-waveform-current-time" text="1:30" bounds="[0,0][50,30]"/>'
                             '<node package="com.k1w1a0style.musikplayer" resource-id="soundcloud-waveform-total-time" text="2:00" bounds="[300,0][350,30]"/></hierarchy>')
        self.assertEqual(timeline_values(root), (90,120))
        with patch.object(smoke, 'tree', return_value=root), patch.object(smoke.time, 'monotonic', side_effect=[0,0,26]), patch.object(smoke.time, 'sleep'):
            with self.assertRaises(AssertionError):
                smoke.assert_duration(90)

    def test_one_time_label_or_ambiguous_player_times_cannot_prove_a_timeline(self):
        for values in ('<node package="com.k1w1a0style.musikplayer" text="1:30"/>',
                       '<node package="com.k1w1a0style.musikplayer" text="0:00"/><node package="com.k1w1a0style.musikplayer" text="1:30"/><node package="com.k1w1a0style.musikplayer" text="2:00"/>'):
            root = ET.fromstring('<hierarchy><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[0,0][50,30]"/>' + values + '</hierarchy>')
            with self.assertRaises(AssertionError):
                timeline_values(root)

    def test_duration_codec_tolerance_is_bounded_to_one_second(self):
        for duration in (88,89,90,91,92):
            root = ET.fromstring('<hierarchy><node><node package="com.k1w1a0style.musikplayer" content-desc="Audiospur-Fortschritt" bounds="[0,0][50,30]"/>'
                                 '<node package="com.k1w1a0style.musikplayer" text="0:04"/>'
                                 f'<node package="com.k1w1a0style.musikplayer" text="1:{duration-60:02}"/></node></hierarchy>')
            with patch.object(smoke, 'tree', return_value=root), patch.object(smoke.time, 'monotonic', side_effect=[0,0,26]), patch.object(smoke.time, 'sleep'):
                if duration in (89,90,91):
                    smoke.assert_duration(90)
                else:
                    with self.assertRaises(AssertionError):
                        smoke.assert_duration(90)

    def scroll_frame(self, bounds='[12,688][468,924]', target=False):
        # Measured bounds from failed retest artifact 11732627939: the two
        # status cards leave only this small vertical song viewport.
        button = '<node content-desc="Wanted" bounds="[28,743][290,826]"/>' if target else ''
        return ET.fromstring('<hierarchy><node class="android.widget.HorizontalScrollView" '
                             'scrollable="true" bounds="[0,137][480,195]"/>'
                             '<node class="android.widget.ScrollView" scrollable="true" '
                             f'bounds="{bounds}">{button}</node></hierarchy>')

    def test_precise_settings_scroll_uses_short_slow_drag_and_exact_public_control(self):
        empty = ET.fromstring('<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"/></hierarchy>')
        full = ET.fromstring('<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node resource-id="settings-instant-colors" bounds="[387,600][459,641]" checked="false"/></node></hierarchy>')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), \
             patch.object(smoke, 'tree', side_effect=[empty,empty,full]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('settings-instant-colors', limit=1).get('checked'), 'false')
            adb.assert_called_once_with('shell','input','swipe','240','708','240','372','800')

    def recorded_song_info_frame(self, edge):
        return ET.parse(Path(__file__).parent / 'fixtures' / f'song-info-font2-clipped-{edge}.xml').getroot()

    def test_recorded_font2_song_info_uses_slow_overlapping_drag_at_either_clip_edge(self):
        key = 'song-card-info-1000000019'
        for edge, coordinates in (('top', ('240','587','240','665')),
                                  ('bottom', ('240','665','240','587'))):
            frame = self.recorded_song_info_frame(edge)
            self.assertEqual(smoke.scroll_bounds(frame, key), (12,529,468,723))
            self.assertIsNone(smoke.scroll_candidate(key, frame))
            # Stop after the first command: inspect the real failing frame,
            # without pretending a model is a successful emulator interaction.
            with self.subTest(edge=edge), tempfile.TemporaryDirectory() as directory, \
                 patch.object(smoke,'OUT',Path(directory)), patch.object(smoke,'tree',return_value=frame), \
                 patch.object(smoke,'adb',side_effect=RuntimeError('captured gesture')) as adb:
                with self.assertRaisesRegex(RuntimeError,'captured gesture'):
                    smoke.scroll_to(key,limit=1)
                adb.assert_called_once_with('shell','input','swipe',*coordinates,'800')

    def test_single_case_mode_exercises_only_requested_case_with_existing_geometry_checks(self):
        frame = ET.parse(Path(__file__).parent / 'fixtures' / 'song-info-font2-whole-standard.xml').getroot()
        # Synthetic current-header control for this harness control-flow test;
        # retain the historical recorded fixture unchanged as native evidence.
        ET.SubElement(frame, 'node', {'package':smoke.PACKAGE, 'enabled':'true',
            'resource-id':'library-open-cleaner', 'bounds':'[210,60][282,132]'})
        first = smoke.candidate('song-card-1000000019',frame)
        menu = smoke.candidate('song-card-info-1000000019',frame)
        def lookup(key, **kwargs):
            return menu if key.startswith('song-card-info-') else first
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'V5_PROOFS',{}), patch.object(smoke,'CHECKS',[]), \
             patch.object(smoke,'tree',return_value=frame), patch.object(smoke,'scroll_to',side_effect=lookup), \
             patch.object(smoke,'find',return_value=first), patch.object(smoke,'adb'), \
             patch.object(smoke,'settings'), patch.object(smoke,'checkbox'), patch.object(smoke,'select') as select, \
             patch.object(smoke,'screenshot'), \
             patch.object(smoke,'inspect_library_panel_screenshot',return_value={'gapPixels':30}), \
             patch.object(smoke,'back'), patch.object(smoke,'tap_node'), \
             patch.object(smoke,'tap'), patch.object(smoke,'pause_matrix_player'), \
             patch.object(smoke,'wait_playing_session',return_value='native ACK fixture'):
            smoke.ui_matrix(selected_cases={('2.0','dark','graphite','compact')})
            self.assertEqual([(c['fontScale'],c['appearance'],c['skin'],c['density']) for c in smoke.V5_PROOFS['matrix']],
                             [('2.0','dark','graphite','compact')])
            self.assertEqual(select.call_args_list[-1].args, ('settings-density-compact',))
            self.assertEqual([c.args[0] for c in select.call_args_list if c.args[0].startswith('settings-density-')],
                             ['settings-density-compact'])
            self.assertEqual(len(smoke.V5_PROOFS['matrix'][0]['section']['controls']),4)
            self.assertEqual(smoke.V5_PROOFS['matrix'][0]['menuBounds'],[380,550,452,622])
        for bad in (set(), {('2.0','dark','graphite','standard')}, {('1.0','dark','graphite','compact')}):
            with self.assertRaisesRegex(AssertionError,'Unsupported targeted matrix selection'):
                smoke.ui_matrix(selected_cases=bad)

    def test_remaining_cases_are_exactly_the_ten_not_already_proved_cases(self):
        old = {(scale,a,s,d) for scale in ('1.0','1.3') for a in ('dark','light')
               for s in ('graphite','minimal','neon-cover') for d in ('standard','compact')}
        old.add(('2.0','dark','graphite','standard'))
        single = smoke.song_info_cases('song-info-single')
        remaining = smoke.song_info_cases('song-info-remaining')
        self.assertEqual(len(old),25)
        self.assertEqual(len(single),1)
        self.assertEqual(len(remaining),10)
        self.assertFalse(old & remaining or old & single or single & remaining)
        self.assertEqual(len(old | single | remaining),36)
        with self.assertRaises(AssertionError):smoke.song_info_cases('full')

    def panel_frame(self):
        frame=ET.parse(Path(__file__).parent / 'fixtures' / 'song-info-font2-whole-standard.xml').getroot()
        smoke.candidate('library-tracks-shell',frame).set('bounds','[0,266][480,924]')
        smoke.vertical_scroll_surface(frame,'song-card-info-1000000019').set('bounds','[12,529][468,759]')
        return frame

    def test_lower_panel_rejects_recorded_original_black_band_and_duplicate_safe_area(self):
        key='song-card-info-1000000019'
        original=ET.parse(Path(__file__).parent / 'fixtures' / 'song-info-font2-whole-standard.xml').getroot()
        with self.assertRaisesRegex(AssertionError,'Painted panel stops'):
            smoke.validate_library_panel_background(original,key,lambda _: (20,21,27))
        double=self.panel_frame()
        smoke.vertical_scroll_surface(double,key).set('bounds','[12,529][468,723]')
        with self.assertRaisesRegex(AssertionError,'safe area twice'):
            smoke.validate_library_panel_background(double,key,lambda _: (20,21,27))

    def test_lower_panel_requires_continuous_pixels_and_real_nonoverlapping_geometry(self):
        key='song-card-info-1000000019'
        proof=smoke.validate_library_panel_background(self.panel_frame(),key,lambda _: (20,21,27))
        self.assertEqual(proof['gapPixels'],30)
        with self.assertRaisesRegex(AssertionError,'Abrupt background band'):
            smoke.validate_library_panel_background(self.panel_frame(),key,
                lambda point:(20,21,27) if point[1]<759 else (10,12,15))
        overlap=self.panel_frame()
        smoke.vertical_scroll_surface(overlap,key).set('bounds','[12,529][468,800]')
        with self.assertRaisesRegex(AssertionError,'overlaps mini-player'):
            smoke.validate_library_panel_background(overlap,key,lambda _: (20,21,27))

    def test_recorded_whole_font2_song_info_requires_no_gesture(self):
        key = 'song-card-info-1000000019'
        frame = ET.parse(Path(__file__).parent / 'fixtures' / 'song-info-font2-whole-standard.xml').getroot()
        with patch.object(smoke,'tree',return_value=frame), patch.object(smoke,'adb') as adb:
            self.assertEqual(smoke.rect(smoke.scroll_to(key)), [380,550,452,622])
            adb.assert_not_called()

    def test_recorded_font2_song_info_never_accepts_persistently_clipped_control(self):
        key = 'song-card-info-1000000019'
        for edge in ('top','bottom'):
            frame = self.recorded_song_info_frame(edge)
            with self.subTest(edge=edge), tempfile.TemporaryDirectory() as directory, \
                 patch.object(smoke,'OUT',Path(directory)), patch.object(smoke,'tree',return_value=frame), \
                 patch.object(smoke,'adb'), patch.object(smoke.time,'sleep'):
                with self.assertRaisesRegex(AssertionError,'Scrollable UI not reachable'):
                    smoke.scroll_to(key,limit=2)

    def test_precise_scroll_keeps_overlapping_viewports_and_native_owner_bounds(self):
        for bounds in ('[12,491][468,742]', '[0,120][480,960]'):
            root = self.scroll_frame(bounds)
            coordinates = smoke.vertical_swipe_coordinates(root, 'Wanted', precise=True)
            x1,y1,x2,y2 = smoke.scroll_bounds(root, 'Wanted')
            self.assertTrue(y1 < coordinates[3] < coordinates[1] < y2)
            self.assertLessEqual(coordinates[1]-coordinates[3], .4*(y2-y1)+2)
            self.assertEqual(coordinates[0], (x1+x2)//2)

    def test_scroll_uses_observed_vertical_bounds_and_excludes_horizontal_tabs(self):
        root = self.scroll_frame()
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted'), (240,889,240,723))
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted', down=True), (240,723,240,889))

    def test_scroll_recalculates_bounds_when_scan_cards_disappear(self):
        for bounds, expected in (('[12,618][468,924]', (240,879,240,663)),
                                 ('[12,220][468,780]', (240,696,240,304))):
            self.assertEqual(smoke.vertical_swipe_coordinates(self.scroll_frame(bounds), 'Wanted'), expected)

    def test_scroll_never_guesses_between_ambiguous_unrelated_vertical_surfaces(self):
        root = self.scroll_frame()
        root.append(ET.fromstring('<node class="androidx.recyclerview.widget.RecyclerView" '
                                 'scrollable="true" bounds="[20,220][460,500]"/>'))
        with self.assertRaises(AssertionError):
            smoke.vertical_swipe_coordinates(root, 'Wanted')
        target = ET.SubElement(root[1], 'node', {'content-desc':'Wanted','bounds':'[0,970][100,1020]'})
        self.assertEqual(smoke.vertical_swipe_coordinates(root, 'Wanted'), (240,889,240,723))

    def test_visible_target_is_used_without_any_unnecessary_scroll(self):
        root = self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', return_value=root), patch.object(smoke, 'adb') as adb:
            self.assertEqual(smoke.scroll_to('Wanted', top=True).get('content-desc'), 'Wanted')
            adb.assert_not_called()

    def test_real_scroll_to_swipes_inside_current_surface_and_rechecks_target(self):
        empty, found = self.scroll_frame(), self.scroll_frame(target=True)
        with patch.object(smoke, 'tree', side_effect=[empty,empty,found]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('content-desc'), 'Wanted')
            adb.assert_called_once_with('shell','input','swipe','240','889','240','723','300')

    def test_system_folder_grant_waits_through_empty_transition_and_is_exact(self):
        empty = ET.fromstring('<hierarchy><node text="3:30"/></hierarchy>')
        grant = ET.fromstring('<hierarchy><node text="Allow k1w1-Musik to access files in V3OnlySAF?"/>'
                             '<node resource-id="android:id/button1" text="ALLOW" enabled="true" bounds="[333,536][432,608]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[empty,grant]), patch.object(smoke.time,'monotonic',side_effect=[0,0,1]), patch.object(smoke.time,'sleep'):
            self.assertEqual(smoke.wait_tree_grant('V3OnlySAF').get('text'),'ALLOW')
        self.assertIsNone(smoke.tree_grant_button(grant,'OtherFolder'))
        grant[1].set('enabled','false')
        self.assertIsNone(smoke.tree_grant_button(grant,'V3OnlySAF'))

    def test_missing_folder_grant_times_out_without_any_confirmation_tap(self):
        with patch.object(smoke,'tree',return_value=ET.fromstring('<hierarchy/>')), patch.object(smoke.time,'monotonic',side_effect=[0,0,26]), patch.object(smoke.time,'sleep'), patch.object(smoke,'tap_node') as tapped:
            with self.assertRaises(AssertionError):
                smoke.wait_tree_grant('V3OnlySAF')
            tapped.assert_not_called()

    def test_compact_action_lookup_keeps_full_fallback_for_pruned_marker(self):
        compact = ET.fromstring('<hierarchy/>')
        full = ET.fromstring('<hierarchy><node resource-id="settings-screen" bounds="[0,36][480,900]"/></hierarchy>')
        with patch.object(smoke,'tree',side_effect=[compact,full]) as capture:
            self.assertEqual(smoke.find('settings-screen').get('resource-id'),'settings-screen')
            self.assertEqual(capture.call_args_list[-1].kwargs,{'compressed':False})

    def test_compact_mini_player_button_still_protects_occluded_song_rows(self):
        root = self.scroll_frame('[12,279][468,894]',target=True)
        root[1][0].set('bounds','[28,746][290,829]')
        ET.SubElement(root,'node',{'resource-id':'mini-player-open','bounds':'[18,808][462,906]'})
        self.assertIsNone(smoke.scroll_candidate('Wanted',root))

    def test_system_picker_uses_innermost_nested_scroll_surface(self):
        root = ET.fromstring('<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,36][480,960]">'
                            '<node class="android.widget.GridView" resource-id="com.google.android.documentsui:id/dir_list" '
                            'scrollable="true" bounds="[0,36][480,960]"><node text="Music" bounds="[317,734][374,763]"/></node></node></hierarchy>')
        self.assertEqual(smoke.vertical_scroll_surface(root,'Music').get('class'),'android.widget.GridView')
        self.assertEqual(smoke.scroll_candidate('Music',root).get('text'),'Music')

    def test_duplicate_targets_on_unrelated_scroll_surfaces_stay_ambiguous(self):
        root = self.scroll_frame(target=True)
        other = ET.SubElement(root,'node',{'class':'android.widget.ScrollView','scrollable':'true','bounds':'[12,220][468,500]'})
        ET.SubElement(other,'node',{'content-desc':'Wanted','bounds':'[28,250][290,333]'})
        with self.assertRaises(AssertionError):
            smoke.vertical_scroll_surface(root,'Wanted')

    def test_scroll_rejects_a_target_partly_covered_by_the_mini_player(self):
        hidden = self.scroll_frame('[12,279][468,894]', target=True)
        hidden[1][0].set('bounds', '[28,746][290,829]')
        ET.SubElement(hidden, 'node', {'resource-id':'mini-player-viewport', 'bounds':'[18,808][462,906]'})
        clear = self.scroll_frame('[12,279][468,894]', target=True)
        clear[1][0].set('bounds', '[28,500][290,583]')
        ET.SubElement(clear, 'node', {'resource-id':'mini-player-viewport', 'bounds':'[18,808][462,906]'})
        for top in (False, True):
            with self.subTest(top=top), patch.object(smoke, 'tree', side_effect=[hidden,clear]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
                result = smoke.scroll_to('Wanted', top=top, limit=1)
                self.assertEqual(result.get('bounds'), '[28,500][290,583]')
                adb.assert_called_once_with('shell','input','swipe','240','729','240','358','300')

    def test_scroll_rejects_a_target_outside_its_native_parent_viewport(self):
        clipped = self.scroll_frame('[12,279][468,600]', target=True)
        clear = self.scroll_frame('[12,279][468,600]', target=True)
        clear[1][0].set('bounds','[28,450][290,533]')
        with patch.object(smoke, 'tree', side_effect=[clipped,clear]), patch.object(smoke, 'adb') as adb, patch.object(smoke.time, 'sleep'):
            self.assertEqual(smoke.scroll_to('Wanted', limit=1).get('bounds'), '[28,450][290,533]')
            adb.assert_called_once()

    def test_public_song_tap_requires_its_native_title_ack_before_opening_player(self):
        node = ET.fromstring('<node bounds="[28,500][290,583]"/>')
        with patch.object(smoke,'wait_uncovered_library_header') as uncovered, patch.object(smoke,'scroll_to',return_value=node), patch.object(smoke,'tap_node') as tap, patch.object(smoke,'wait_selected_session') as ack, patch.object(smoke,'find'):
            smoke.play_title('V3 SAF')
            uncovered.assert_called_once()
            tap.assert_called_once_with(node)
            ack.assert_called_once_with('V3 SAF')

    def test_recorded_player_overlay_cannot_expose_underlying_song_to_input(self):
        # Run 39073420914, artifact 12117515382: Android reports enabled library
        # rows beneath the actual full-screen player during its closing transition.
        overlay = ET.parse(Path(__file__).parent/'fixtures/player-over-library.xml').getroot()
        self.assertIsNotNone(smoke.candidate('V3 M4A von V3 Proof', overlay))
        self.assertIsNotNone(smoke.candidate('now-playing-screen', overlay))
        ready = self.header_frame()
        events = []
        frames = [overlay, overlay, overlay, ready, ready, ready]
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'tree',side_effect=lambda **kwargs: events.append('frame') or frames.pop(0)), \
             patch.object(smoke.time,'sleep'), \
             patch.object(smoke,'scroll_to',side_effect=lambda *a,**k: events.append('locate') or ET.fromstring('<node bounds="[28,545][290,628]"/>')), \
             patch.object(smoke,'tap_node',side_effect=lambda n: events.append('tap')), \
             patch.object(smoke,'wait_selected_session',side_effect=lambda title:events.append('native-title-ack')), patch.object(smoke,'find'):
            smoke.play_title('V3 M4A')
        self.assertEqual(events, ['frame']*6+['locate','tap','native-title-ack'],
                         'Underlying library was tapped before the player left the foreground')

    def test_missing_or_offscreen_vertical_surface_is_not_touched(self):
        for bounds in ('[12,970][468,1100]', '[-20,220][468,780]', '[12,688][468,710]'):
            with self.assertRaises(AssertionError):
                smoke.vertical_swipe_coordinates(self.scroll_frame(bounds), 'Wanted')

    def playlist_frame(self, ids=('a','b'), titles=('MP3','M4A'), package=smoke.PACKAGE):
        root = ET.fromstring('<hierarchy><node resource-id="playlist-detail-screen" bounds="[0,0][480,900]"/></hierarchy>')
        for index, (identifier, title) in enumerate(zip(ids,titles)):
            ET.SubElement(root[0], 'node', {'package':package,'resource-id':'playlist-detail-song-'+identifier,
                'content-desc':f'{title} von V3 Proof abspielen. Position {index+1} von {len(ids)}'})
        return root

    def test_backup_restore_requires_real_playlist_ids_order_metadata_and_count(self):
        smoke.validate_playlist_contents(self.playlist_frame(), ['a','b'], ['MP3','M4A'])
        for frame in (self.playlist_frame(ids=('b','a')),self.playlist_frame(titles=('MP3','Wrong')),
                      self.playlist_frame(ids=('a',),titles=('MP3',)),self.playlist_frame(package='com.other.app')):
            with self.assertRaises(AssertionError):
                smoke.validate_playlist_contents(frame,['a','b'],['MP3','M4A'])
        frame=self.playlist_frame();frame[0][0].set('content-desc','MP3 von V3 Proof abspielen. Position 1 von 3')
        with self.assertRaises(AssertionError):
            smoke.validate_playlist_contents(frame,['a','b'],['MP3','M4A'])

    def playing_session(self, title='V3 FLAC', state=3, package=smoke.PACKAGE):
        return f'package={package}\nstate=PlaybackState {{state={state}, position=4000}}\nmetadata: description={title}, V3 Proof'

    def test_selection_ack_is_exact_and_does_not_claim_decoder_playback(self):
        selected = self.playing_session(title='V3 M4A',state=0)
        smoke.validate_selected_session(selected,'V3 M4A')
        with self.assertRaises(AssertionError):
            validate_playing_session(selected,'V3 M4A')
        for title, package in [('V3 M4A extra',smoke.PACKAGE),('V3 FLAC',smoke.PACKAGE),('V3 M4A','com.other.app')]:
            with self.assertRaises(AssertionError):
                smoke.validate_selected_session(self.playing_session(title=title,package=package),'V3 M4A')

    def test_native_session_requires_own_app_playing_and_actual_title(self):
        validate_playing_session(self.playing_session(), 'V3 FLAC')
        for session in (self.playing_session(state=2), self.playing_session(title='V3 M4A'),
                        self.playing_session(package=smoke.PACKAGE+'.other')):
            with self.assertRaises(AssertionError):
                validate_playing_session(session, 'V3 FLAC')

    def native_stack(self, app_state='PLAYING(3)', other_state='PAUSED(2)', app_title='V3 FLAC'):
        # Structure and named state copied from the actual API-35 failing run.
        return f'''MEDIA SESSION SERVICE (dumpsys media_session)
  Sessions Stack - have 2 sessions:
    androidx.media3.session.id. com.k1w1a0style.musikplayer/7 (userId=0)
      ownerPid=4108, ownerUid=10209, userId=0
      package={smoke.PACKAGE}
      active=true
      state=PlaybackState {{state={app_state}, position=33301, speed=1.0}}
      metadata: description={app_title}, V3 Proof
    OtherPlayer com.other.player/2 (userId=0)
      ownerPid=555, ownerUid=12345, userId=0
      package=com.other.player
      state=PlaybackState {{state={other_state}, position=4000, speed=1.0}}
      metadata: description=V3 M4A, Other Artist
Audio playback (lastly played comes first)
  uid=10209 packages={smoke.PACKAGE}
'''

    def read_session(self, dump):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke, 'OUT', Path(directory)), patch.object(smoke, 'adb', return_value=dump.encode()):
            return smoke.app_media_session()

    def test_observed_android_named_playing_state_and_legacy_numeric_are_supported(self):
        for state in ('PLAYING(3)', '3'):
            session = self.read_session(self.native_stack(app_state=state))
            self.assertNotIn('package=com.other.player', session)
            validate_playing_session(session, 'V3 FLAC')

    def test_a_foreign_playing_session_never_proves_our_paused_player(self):
        session = self.read_session(self.native_stack(app_state='PAUSED(2)', other_state='3'))
        with self.assertRaises(AssertionError):
            validate_playing_session(session, 'V3 FLAC')

    def test_a_foreign_metadata_title_never_proves_our_selected_track(self):
        session = self.read_session(self.native_stack(app_state='3', app_title='Wrong Track'))
        with self.assertRaises(AssertionError):
            validate_playing_session(session, 'V3 M4A')

    def test_duplicate_own_sessions_are_ambiguous_and_named_nonplaying_is_rejected(self):
        duplicate = self.native_stack().replace('package=com.other.player', f'package={smoke.PACKAGE}')
        with self.assertRaises(AssertionError):
            self.read_session(duplicate)
        for state in ('PAUSED(2)', 'PAUSED(3)', 'PLAYING(2)', '33', 'BUFFERING(6)'):
            with self.assertRaises(AssertionError):
                validate_playing_session(self.playing_session(state=state), 'V3 FLAC')

    def test_metadata_only_or_stalled_progress_fails_playback_proof(self):
        for positions in ((4,4), (4,5), (4,40)):
            with patch.object(smoke, 'wait_playing_session'), patch.object(smoke, 'app_media_session', return_value=self.playing_session()), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
                with self.assertRaises(AssertionError):
                    assert_native_playback('V3 FLAC', 150, iter(positions).__next__)
        with patch.object(smoke, 'wait_playing_session'), patch.object(smoke, 'app_media_session', return_value=self.playing_session(state=2)), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
            with self.assertRaises(AssertionError):
                assert_native_playback('V3 FLAC', 150, iter((4,8)).__next__)

    def test_advancing_progress_and_confirmed_session_record_evidence(self):
        previous = list(smoke.PLAYBACK_PROOFS)
        try:
            with patch.object(smoke, 'wait_playing_session') as wait, patch.object(smoke, 'app_media_session', return_value=self.playing_session()), patch.object(smoke.time, 'sleep'), patch.object(smoke.time, 'monotonic', side_effect=[0,4]):
                assert_native_playback('V3 FLAC', 150, iter((4,8)).__next__)
                wait.assert_called_once_with('V3 FLAC')
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['beforeSeconds'], 4)
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['afterSeconds'], 8)
            self.assertEqual(smoke.PLAYBACK_PROOFS[-1]['nativeState'], 3)
        finally:
            smoke.PLAYBACK_PROOFS[:] = previous

    def test_horizontal_cover_swipe_is_rightwards_inside_visible_cover(self):
        node = ET.fromstring('<node bounds="[0,210][480,760]"/>')
        self.assertEqual(horizontal_swipe_coordinates(node), (72,485,408,485))
        for bounds in ('[0,210][80,760]', '[0,210][480,980]'):
            with self.assertRaises(AssertionError):
                horizontal_swipe_coordinates(ET.fromstring(f'<node bounds="{bounds}"/>'))

    def cleaner_bytes(self, title='V5  Cleaner', artist='V5  Proof', audio=b'encoded-MP3-audio', replacements=None):
        values = {'TIT2': b'\x00' + title.encode(), 'TPE1': b'\x00' + artist.encode(), 'APIC': b'cover',
                  'TPUB': b'publisher', 'WXXX': b'website', 'TXXX': b'\x00REPLAYGAIN_TRACK_GAIN\x00-7.50 dB', 'XKIW': b'unknown'}
        values.update(replacements or {})
        body = b''.join(key.encode() + len(value).to_bytes(4, 'big') + b'\x00\x00' + value for key, value in values.items())
        return b'ID3\x03\x00\x00' + smoke.synchsafe(len(body)) + body + audio

    def test_independent_cleaner_proof_requires_audio_and_preserved_frames(self):
        before = self.cleaner_bytes()
        after = self.cleaner_bytes('V5 Cleaner', 'V5 Proof')
        proof = smoke.validate_cleaner_write(before, after)
        self.assertNotEqual(proof['beforeSha256'], proof['afterSha256'])
        self.assertEqual(proof['audioSha256'], hashlib.sha256(b'encoded-MP3-audio').hexdigest())
        for corrupted in [before, self.cleaner_bytes('V5 Cleaner', 'V5 Proof', audio=b'changed audio'),
                          self.cleaner_bytes('V5 Wrong', 'V5 Proof')] + [
                          self.cleaner_bytes('V5 Cleaner', 'V5 Proof', replacements={field: b'changed'})
                          for field in ('APIC', 'TPUB', 'WXXX', 'TXXX', 'XKIW')]:
            with self.assertRaises(AssertionError):
                smoke.validate_cleaner_write(before, corrupted)

    def test_independent_cleaner_parser_rejects_truncated_or_unsupported_input(self):
        valid = self.cleaner_bytes()
        for malformed in [valid[:8], valid[:20], valid.replace(b'ID3', b'BAD', 1),
                          valid[:3] + b'\x02' + valid[4:], valid[:5] + b'\x80' + valid[6:]]:
            with self.assertRaises(AssertionError):
                smoke.id3_frames(malformed)
        frames, audio = smoke.id3_frames(valid)
        self.assertEqual(frames['XKIW'], [b'unknown'])
        self.assertEqual(audio, b'encoded-MP3-audio')

    def test_v5_radios_require_the_exact_checked_visible_public_control(self):
        key = 'settings-appAccent-purple'
        for checked, identifier, bounds in [('true', key, '[10,20][110,90]'),
                                           ('false', key, '[10,20][110,90]'),
                                           ('true', 'settings-playerAccent-purple', '[10,20][110,90]'),
                                           ('true', key, '[10,20][110,1000]')]:
            root = ET.fromstring(f'<hierarchy><node resource-id="{identifier}" checked="{checked}" bounds="{bounds}"/></hierarchy>')
            if checked == 'true' and identifier == key and bounds.endswith('90]'):
                smoke.assert_radio_selected(root, key)
            else:
                with self.assertRaises(AssertionError):
                    smoke.assert_radio_selected(root, key)
        self.assertEqual(len(smoke.ACCENT_IDS), 12)
        self.assertEqual(len(set(smoke.ACCENT_IDS)), 12)

    def test_cleaner_confirms_only_exact_change_list_mode_and_enabled_action(self):
        result = ET.fromstring('<hierarchy><node text="Anzeige gespeichert"/>'
                              '<node text="1 geprüft · 0 unverändert · 1 geändert · 0 ausgelassen · 0 fehlgeschlagen · 0 offen / unterbrochen"/></hierarchy>')
        for title, enabled, listed in [('Nur Bibliotheksanzeige','true',True),('Originaldatei-Tags schreiben','true',True),('Nur Bibliotheksanzeige','false',True),('Nur Bibliotheksanzeige','true',False)]:
            dialog = ET.fromstring(f'<hierarchy><node text="{title}"/>'
                                  f'<node resource-id="tag-cleaner-confirm-apply" enabled="{enabled}" bounds="[1,1][80,80]"/>'
                                  + ('<node resource-id="tag-cleaner-confirm-list" bounds="[1,100][400,500]"/>' if listed else '') + '</hierarchy>')
            with patch.object(smoke,'select'),patch.object(smoke,'find'),patch.object(smoke,'tap_node') as tapped,patch.object(smoke,'scroll_to'),patch.object(smoke,'tree',side_effect=[dialog,result,result]):
                if title=='Nur Bibliotheksanzeige' and enabled=='true' and listed:
                    smoke.cleaner_apply_dialog('display');tapped.assert_called_once()
                else:
                    with self.assertRaises(AssertionError):smoke.cleaner_apply_dialog('display')
                    tapped.assert_not_called()

    def test_font2_cleaner_tools_must_scroll_to_offscreen_safe_selection(self):
        # Run 39076906825 / artifact 12118175468: the expanded tools start at
        # y=543 in a list ending at y=587. Their safe action is initially offscreen.
        events=[]
        def visible_find(key, **kwargs):
            events.append(('find',key))
            if key=='tag-cleaner-select-safe':
                raise AssertionError('Native font2 safe action is outside the current viewport')
        with patch.object(smoke,'find',side_effect=visible_find), \
             patch.object(smoke,'select',side_effect=lambda key,**k:events.append(('open',key))), \
             patch.object(smoke,'scroll_to',side_effect=lambda key,**k:events.append(('scroll',key))):
            smoke.wait_cleaner_preview_tools()
        self.assertEqual(events,[('find','tag-cleaner-apply'),('open','tag-cleaner-tools'),('scroll','tag-cleaner-select-safe')])

    def test_cleaner_result_rejects_failed_pending_skipped_or_other_mode_success(self):
        summary='1 geprüft · 0 unverändert · 1 geändert · 0 ausgelassen · 0 fehlgeschlagen · 0 offen / unterbrochen'
        valid=ET.fromstring(f'<hierarchy><node text="Datei und Anzeige bestätigt"/><node text="{summary}"/></hierarchy>')
        smoke.validate_cleaner_result(valid,'file')
        for status,text in [('Datei und Anzeige bestätigt',summary.replace('0 fehlgeschlagen','1 fehlgeschlagen')),
                            ('Datei und Anzeige bestätigt',summary.replace('0 offen / unterbrochen','1 offen / unterbrochen')),
                            ('Datei und Anzeige bestätigt',summary.replace('0 ausgelassen','1 ausgelassen')),
                            ('Datei und Anzeige bestätigt',summary.replace('1 geprüft','11 geprüft')),
                            ('Anzeige gespeichert',summary),('Datei geändert – Anzeige nicht bestätigt',summary)]:
            root=ET.fromstring(f'<hierarchy><node text="{status}"/><node text="{text}"/></hierarchy>')
            with self.assertRaises(AssertionError):smoke.validate_cleaner_result(root,'file')

    def test_settings_scrolls_real_library_menu_and_requires_owned_whole_action(self):
        node = ET.fromstring(f'<node package="{smoke.PACKAGE}" enabled="true" bounds="[70,700][443,792]"/>')
        header = ET.fromstring(f'<node package="{smoke.PACKAGE}" enabled="true" bounds="[378,73][450,145]"/>')
        card = ET.Element('node',{'package':smoke.PACKAGE})
        with patch.object(smoke,'wait_uncovered_library_header',return_value=header), patch.object(smoke,'scroll_to',return_value=node) as scroll, patch.object(smoke,'tap_node') as touch, patch.object(smoke,'find',return_value=card) as find:
            smoke.settings()
            scroll.assert_called_once_with('library-menu-item-einstellungen')
            self.assertEqual([call.args[0] for call in touch.call_args_list],[header,node])
            self.assertEqual([call.args[0] for call in find.call_args_list],['library-menu-card','settings-screen'])
        for attrs in ({'package':'com.android.documentsui'},{'enabled':'false'},{'bounds':'[70,906][443,937]'}):
            bad = ET.fromstring(ET.tostring(node))
            bad.attrib.update(attrs)
            with patch.object(smoke,'wait_uncovered_library_header',return_value=header),patch.object(smoke,'find',return_value=card),patch.object(smoke,'scroll_to',return_value=bad),patch.object(smoke,'tap_node') as touch:
                with self.assertRaises(AssertionError):smoke.settings()
                touch.assert_called_once_with(header)

    def test_clipped_settings_menu_is_revealed_by_inside_owner_slow_swipe(self):
        key='library-menu-item-einstellungen'
        frame=ET.fromstring(f'<hierarchy><node package="{smoke.PACKAGE}" class="android.widget.ScrollView" scrollable="true" bounds="[70,97][443,937]"><node package="{smoke.PACKAGE}" enabled="true" resource-id="{key}" bounds="[70,906][443,937]"/></node></hierarchy>')
        self.assertIsNone(smoke.scroll_candidate(key,frame))
        revealed=ET.fromstring(ET.tostring(frame))
        target=next(n for n in revealed.iter('node') if n.get('resource-id')==key)
        target.set('bounds','[70,700][443,792]')
        with patch.object(smoke,'scroll_query_frame',side_effect=[frame,revealed]),patch.object(smoke,'adb') as adb,patch.object(smoke.time,'sleep'):
            self.assertIs(smoke.scroll_to(key),target)
            adb.assert_called_once_with('shell','input','swipe','256','685','256','349','800')

    def test_native_settings_ids_choose_direct_direction_instead_of_full_top_roundtrip(self):
        position=[2]
        ids=['settings-waveform-accent-blue','settings-tag-cleaner','settings-appearance-dark','settings-skin-minimal']
        def frame():
            return ET.fromstring(f'<hierarchy><node resource-id="settings-scroll" package="{smoke.PACKAGE}" class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node package="{smoke.PACKAGE}" resource-id="{ids[position[0]]}" bounds="[21,667][459,871]"/></node></hierarchy>')
        def swipe(*args):
            position[0]=max(0,min(3,position[0]+(-1 if int(args[4])<int(args[6]) else 1)))
        with patch.object(smoke,'scroll_query_frame',side_effect=lambda key:frame()),patch.object(smoke,'adb',side_effect=swipe) as adb,patch.object(smoke.time,'sleep'):
            self.assertEqual(smoke.scroll_to('settings-skin-minimal',top=True).get('resource-id'),'settings-skin-minimal')
            adb.assert_called_once_with('shell','input','swipe','240','708','240','372','800')

    def test_settings_order_uses_exact_owned_observed_controls_and_source_option_order(self):
        root=ET.fromstring(f'<hierarchy><node resource-id="settings-scroll" package="{smoke.PACKAGE}" class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node package="{smoke.PACKAGE}" resource-id="settings-tag-cleaner" bounds="[47,457][434,540]"/><node package="{smoke.PACKAGE}" resource-id="settings-appearance-dark" bounds="[21,667][459,871]"/></node></hierarchy>')
        self.assertIsNone(smoke.settings_scroll_direction(root,'settings-skin-minimal'))
        self.assertIsNone(smoke.settings_scroll_direction(root,'settings-quiet-profile'))
        self.assertIs(smoke.settings_scroll_direction(root,'settings-color-target-appAccent'),True)
        self.assertIsNone(smoke.settings_scroll_direction(root,'settings-unknown-option'))
        for field,value in (('package','com.android.documentsui'),('resource-id','other-scroll')):
            bad=ET.fromstring(ET.tostring(root));bad[0].set(field,value)
            self.assertIsNone(smoke.settings_scroll_direction(bad,'settings-skin-minimal'))
        for node in root[0]:node.set('package','com.android.documentsui')
        self.assertIsNone(smoke.settings_scroll_direction(root,'settings-skin-minimal'))

    def test_top_search_reaches_earlier_control_beyond_ten_measured_drags(self):
        key = 'settings-quiet-profile'
        position = [14]
        def frame():
            root = ET.fromstring(f'<hierarchy><node resource-id="settings-scroll" class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node text="section-{position[0]}" bounds="[20,300][300,360]"/></node></hierarchy>')
            if position[0] == 2:
                ET.SubElement(root[0], 'node', {'resource-id':key, 'checked':'true', 'bounds':'[364,496][436,537]'})
            return root
        def swipe(*args):
            position[0] += -1 if int(args[4]) < int(args[6]) else 1
        with patch.object(smoke,'scroll_query_frame',side_effect=lambda key:frame()), patch.object(smoke,'adb',side_effect=swipe) as adb, patch.object(smoke.time,'sleep'):
            self.assertEqual(smoke.scroll_to(key,top=True).get('checked'),'true')
            self.assertEqual(position[0],2)
            self.assertEqual(adb.call_count,12)

    def test_top_search_changes_direction_only_after_three_equal_owner_frames(self):
        position = [0]
        key = 'settings-quiet-profile'
        def frame():
            root = ET.fromstring(f'<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node text="section-{position[0]}" bounds="[20,300][300,360]"/></node><node package="com.android.systemui" text="clock-changing" bounds="[0,0][40,30]"/></hierarchy>')
            if position[0] == 2:
                ET.SubElement(root[0],'node',{'resource-id':key,'bounds':'[364,496][436,537]'})
            return root
        def swipe(*args):
            position[0] = max(0, position[0]+(-1 if int(args[4])<int(args[6]) else 1))
        with patch.object(smoke,'scroll_query_frame',side_effect=lambda key:frame()), patch.object(smoke,'adb',side_effect=swipe) as adb, patch.object(smoke.time,'sleep'):
            self.assertIsNotNone(smoke.scroll_to(key,top=True))
            self.assertEqual(adb.call_count,4)

    def test_stationary_missing_control_fails_without_endless_identical_swipes(self):
        frame = ET.fromstring('<hierarchy><node class="android.widget.ScrollView" scrollable="true" bounds="[0,120][480,960]"><node text="real boundary" bounds="[20,300][300,360]"/></node></hierarchy>')
        with patch.object(smoke,'scroll_query_frame',return_value=frame),patch.object(smoke,'adb') as adb,patch.object(smoke.time,'sleep'),patch.object(smoke,'tap_node') as tap:
            with self.assertRaises(AssertionError):smoke.scroll_to('settings-quiet-profile',top=True)
            self.assertLessEqual(adb.call_count,4)
            tap.assert_not_called()

    def test_header_acceptance_rejects_recorded_font2_clip_and_requires_whole_48dp_controls(self):
        def frame(search,menu,package=smoke.PACKAGE,cleaner='[210,60][282,132]'):
            return ET.fromstring(f'<hierarchy><node package="{package}" enabled="true" resource-id="library-open-cleaner" bounds="{cleaner}"/><node package="{package}" enabled="true" resource-id="library-toggle-search" bounds="{search}"/><node package="{package}" enabled="true" resource-id="library-open-menu" bounds="{menu}"/></hierarchy>')
        for root in (frame('[399,81][456,138]','[468,81][480,138]'),frame('[390,60][462,132]','[470,60][542,132]'),frame('[300,60][380,132]','[370,60][442,132]'),frame('[294,60][366,132]','[378,60][450,132]','com.android.documentsui')):
            with self.assertRaises(AssertionError):smoke.validate_library_header_touch_areas(root)
        self.assertEqual(smoke.validate_library_header_touch_areas(frame('[294,60][366,132]','[378,60][450,132]'))['menuBounds'],[378,60,450,132])
        for cleaner in ('[230,60][302,132]', '[210,60][282,115]', '[210,-10][282,62]'):
            with self.assertRaises(AssertionError):
                smoke.validate_library_header_touch_areas(frame('[294,60][366,132]','[378,60][450,132]',cleaner=cleaner))

    def test_reusing_cases_does_not_append_new_cases_to_original_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'verified-matrix-origin.json').write_text(json.dumps({'cases':[]}))
            with patch.dict(smoke.os.environ,{'PREVIOUS_MATRIX_EVIDENCE':str(root)}),patch.object(smoke,'V5_PROOFS',{}),patch.object(smoke,'validate_previous_matrix',side_effect=lambda data:data['cases']):
                cases=smoke.previous_matrix_cases()
                cases.append({'fresh-native-case':True})
                self.assertEqual(smoke.V5_PROOFS['matrixEvidenceOrigins'][0]['cases'],[])

    def test_latest_previous_matrix_requires_all_twenty_six_exact_native_cases(self):
        cases=[{'fontScale':scale,'appearance':appearance,'skin':skin,'density':density,'playBounds':[20,200,300,300],'menuBounds':[380,200,452,272]}
               for scale in ('1.0','1.3') for appearance in ('dark','light') for skin in ('graphite','minimal','neon-cover') for density in ('standard','compact')]
        cases += [{'fontScale':'2.0','appearance':'dark','skin':'graphite','density':density,'playBounds':[20,200,300,300],'menuBounds':[380,200,452,272]} for density in ('standard','compact')]
        data={'sourceCommit':'70275c7a66aa9d24e5c2a33421388d93ad9a20d6','apkSha256':'f1d587e8ddbd5d1bd7cfbb07ba9104a55d8d17bd94c372babaadbe1df6831807','harnessCommit':'e65cf4ce3d87a7ad310facf43a27c7d076782557','run':38505950487,'artifactDigest':'sha256:749abd2df08334fde929a62f13ce04c075565a6955d03d5cc2291ce88814cbe1','cases':cases}
        self.assertEqual(smoke.validate_previous_matrix(data),cases)
        for broken in (cases[:24],cases[:-1],cases[:-1]+[cases[0]]):
            with self.assertRaises(AssertionError):smoke.validate_previous_matrix(dict(data,cases=broken))
        for field in ('sourceCommit','apkSha256','harnessCommit','run','artifactDigest'):
            with self.assertRaises(AssertionError):smoke.validate_previous_matrix(dict(data,**{field:'wrong'}))

    def test_previous_matrix_requires_complete_pinned_real_coverage(self):
        cases=[{'fontScale':scale,'appearance':appearance,'skin':skin,'density':density,'playBounds':[20,200,300,300],'menuBounds':[380,200,452,272]}
               for scale in ('1.0','1.3') for appearance in ('dark','light') for skin in ('graphite','minimal','neon-cover') for density in ('standard','compact')]
        origin={'sourceCommit':'70275c7a66aa9d24e5c2a33421388d93ad9a20d6','apkSha256':'f1d587e8ddbd5d1bd7cfbb07ba9104a55d8d17bd94c372babaadbe1df6831807','harnessCommit':'956aa2411c67ba890369a686b6ffdb402070f99a','run':38502985939,'artifactDigest':'sha256:3c41fb19942e57dea9df9ee954ba8f68fccf9d6fd577794bc291eeacbe1e1c05','cases':cases}
        self.assertEqual(smoke.validate_previous_matrix(origin),cases)
        for field in ('sourceCommit','apkSha256','harnessCommit','run','artifactDigest'):
            bad=dict(origin);bad[field]='wrong'
            with self.assertRaises(AssertionError):smoke.validate_previous_matrix(bad)
        for broken in (cases[:-1],cases+[cases[0]],cases[:-1]+[cases[0]]):
            with self.assertRaises(AssertionError):smoke.validate_previous_matrix(dict(origin,cases=broken))
        for field,value in (('menuBounds',[380,200,452,203]),('playBounds',[20,200,390,300])):
            broken=json.loads(json.dumps(cases));broken[0][field]=value
            with self.assertRaises(AssertionError):smoke.validate_previous_matrix(dict(origin,cases=broken))


    def test_format_selection_requires_three_terminal_scan_frames_before_coordinate_tap(self):
        # Recorded failed run: first MP3 row was already visible while the
        # import-status still said metadata/cover importing; its coordinates
        # subsequently became M4A. The first row alone is not an import ACK.
        busy=ET.fromstring(f'<hierarchy><node resource-id="library-import-status" package="{smoke.PACKAGE}" bounds="[30,207][450,327]"/><node resource-id="library-import-status-text" text="Metadaten und Cover werden importiert…"/><node resource-id="library-open-menu" package="{smoke.PACKAGE}" enabled="true" bounds="[378,51][450,123]"/></hierarchy>')
        idle=ET.fromstring(f'<hierarchy><node resource-id="library-open-menu" package="{smoke.PACKAGE}" enabled="true" bounds="[378,51][450,123]"/></hierarchy>')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'import_public_collection'), patch.object(smoke,'tree',side_effect=[busy,busy,idle,idle,idle]) as frames, \
             patch.object(smoke.time,'sleep'), patch.object(smoke,'play_title',side_effect=RuntimeError('first format boundary')) as play:
            with self.assertRaisesRegex(RuntimeError,'first format boundary'):smoke.prepare_collection()
            self.assertEqual(frames.call_count,5,'Playback tapped before the native terminal scan ACK')
            play.assert_called_once_with(smoke.TITLES[0])

    def test_unfinished_import_must_fail_without_any_format_tap(self):
        busy=ET.fromstring(f'<hierarchy><node resource-id="library-import-status" package="{smoke.PACKAGE}" bounds="[30,207][450,327]"/><node resource-id="library-open-menu" package="{smoke.PACKAGE}" enabled="true" bounds="[378,51][450,123]"/></hierarchy>')
        clock=iter(range(1000))
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'import_public_collection'), patch.object(smoke,'tree',return_value=busy), \
             patch.object(smoke.time,'sleep'), patch.object(smoke.time,'monotonic',side_effect=lambda:next(clock)), \
             patch.object(smoke,'play_title') as play:
            with self.assertRaisesRegex(AssertionError,'scan or persistence status did not finish'):smoke.prepare_collection()
            play.assert_not_called()



class CleanerResultScrollRegressionTest(unittest.TestCase):
    # Exact final.xml from run39688915146/artifact12389495057, archive SHA256
    # f1477c60434a68e09135722ddbc52ba15eb9f2cc7012529faab1e4bf11287dbe.
    key = 'tag-cleaner-result-export'

    def recorded(self):
        return ET.parse(Path(__file__).parent / 'fixtures/cleaner-result-font2-clipped-39688915146.xml').getroot()

    def test_recorded_clipped_export_is_scrolled_before_geometry_validation(self):
        clipped=self.recorded()
        self.assertEqual(rect(smoke.candidate(self.key,clipped)),[24,728,456,784])
        self.assertIsNone(smoke.scroll_candidate(self.key,clipped))
        whole=self.recorded()
        target=next(n for n in whole.iter('node') if n.get('resource-id')==self.key)
        target.set('bounds','[24,620][456,760]')
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'scroll_query_frame',side_effect=[clipped,whole]), \
             patch.object(smoke,'adb') as adb, patch.object(smoke.time,'sleep'):
            self.assertIs(smoke.scroll_to(self.key),target)
            adb.assert_called_once_with('shell','input','swipe','240','661','240','495','800')
        from androidCleanerGeometry import validate_targets
        validate_targets(whole,[self.key],smoke.PACKAGE)

    def test_tall_clipped_export_requires_clearance_even_above_the_touch_minimum(self):
        clipped=self.recorded()
        target=next(n for n in clipped.iter('node') if n.get('resource-id')==self.key)
        target.set('bounds','[24,680][456,784]')
        # 104 visible pixels meet the touch minimum but can still hide text.
        self.assertIsNone(smoke.scroll_candidate(self.key,clipped))
        target.set('bounds','[24,620][456,760]')
        self.assertIs(smoke.scroll_candidate(self.key,clipped),target)

    def test_permanently_clipped_export_still_fails_without_tapping(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke,'scroll_query_frame',side_effect=lambda key:self.recorded()), \
             patch.object(smoke,'adb'), patch.object(smoke,'tap_node') as tap, patch.object(smoke.time,'sleep'):
            with self.assertRaisesRegex(AssertionError,'not reachable'):
                smoke.scroll_to(self.key,limit=2)
            tap.assert_not_called()


class FormatPlayerBackRuntimeTest(unittest.TestCase):
    def test_recorded_native_image_parent_crash_blocks_library_ack(self):
        trace=(Path(__file__).parent/'fixtures/fabric-cover-pause-back-crash-39696123417.txt').read_bytes()
        with patch.object(smoke,'back') as back, patch.object(smoke,'adb',return_value=trace) as adb, \
             patch.object(smoke,'wait_uncovered_library_header') as header:
            with self.assertRaisesRegex(AssertionError,'Runtime failure returning'):
                smoke.return_format_player_to_library()
            back.assert_called_once_with()
            adb.assert_called_once_with('logcat','-d','-v','threadtime')
            header.assert_not_called()

    def test_healthy_player_back_requires_runtime_check_then_stable_library(self):
        events=[]
        with patch.object(smoke,'back',side_effect=lambda:events.append('hardware-back')), \
             patch.object(smoke,'adb',side_effect=lambda *args:events.append('runtime-check') or b'healthy'), \
             patch.object(smoke,'wait_uncovered_library_header',side_effect=lambda:events.append('library-ack')):
            smoke.return_format_player_to_library()
        self.assertEqual(events,['hardware-back','runtime-check','library-ack'])


if __name__ == '__main__':
    unittest.main()
