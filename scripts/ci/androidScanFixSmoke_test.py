import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import androidScanFixSmoke as smoke
import xml.etree.ElementTree as ET
from androidScanFixSmoke import scan_receipt

class ScanReceiptTest(unittest.TestCase):
    def frame(self, terminal='Aktualisierung – abgeschlossen', processed=12, total=12, errors=0):
        root=ET.Element('hierarchy')
        for text in (terminal,f'{processed} von {total} gefundenen Dateien verarbeitet',f'Neu: 12 · Geändert: 0 · Unverändert: 0 · Ungeprüft: 0 · Leseprobleme: {errors}'):
            ET.SubElement(root,'node',{'text':text,'package':'com.k1w1a0style.musikplayer'})
        return root
    def test_complete_requires_real_terminal_ack_and_all_twelve_files(self):
        self.assertIn('Neu: 12',scan_receipt(self.frame(),12))
        for root in (self.frame(processed=2), self.frame(terminal='Aktualisierung – teilweise abgeschlossen'), self.frame(errors=2)):
            with self.assertRaises(AssertionError):scan_receipt(root,12)
    def test_unrelated_app_text_never_proves_scan_completion(self):
        root=self.frame()
        for node in root:node.set('package','other.app')
        with self.assertRaises(AssertionError):scan_receipt(root,12)
    def test_partial_source_requires_an_actual_warning_and_all_known_readable_files(self):
        root = self.frame(terminal='Aktualisierung – teilweise abgeschlossen', errors=1)
        self.assertIn('Leseprobleme: 1', scan_receipt(root, 12, partial=True))
        with self.assertRaises(AssertionError): scan_receipt(root, 12)
        with self.assertRaises(AssertionError): scan_receipt(self.frame(), 12, partial=True)
        with self.assertRaises(AssertionError): scan_receipt(root, 24, partial=True)


    def test_scan_receipt_requires_foreground_return_and_confirmed_detail_opening(self):
        before=ET.fromstring('<hierarchy><node package="com.k1w1a0style.musikplayer" content-desc="Verarbeitungsdetails öffnen" enabled="true" bounds="[23,51][95,123]"/></hierarchy>')
        after=self.frame()
        for text in ('Scan-Details','Verarbeitungsdetails schließen'):
            ET.SubElement(after,'node',{'package':smoke.ui.PACKAGE,'text':text,'content-desc':text,'enabled':'true','bounds':'[30,100][450,172]'})
        close=list(after)[-1]
        with tempfile.TemporaryDirectory() as directory, patch.object(smoke,'OUT',Path(directory)), \
             patch.object(smoke.ui,'wait_uncovered_library_header') as ready, \
             patch.object(smoke.ui,'adb',return_value=('mCurrentFocus=Window{abc u0 '+smoke.ui.PACKAGE+'/.MainActivity}').encode()), \
             patch.object(smoke.ui,'tree',side_effect=[before,after,after]), \
             patch.object(smoke.ui,'find',return_value=close),patch.object(smoke.ui,'tap'), \
             patch.object(smoke.ui,'tap_node') as tap,patch.object(smoke.ui,'screenshot'),patch.object(smoke.time,'sleep'):
            self.assertIn('Neu: 12',smoke.wait_scan('confirmed'))
            ready.assert_called_once()
            tap.assert_called_once()


    def test_foreground_focus_never_accepts_picker_other_app_or_similar_package_name(self):
        self.assertTrue(smoke.has_app_focus('mCurrentFocus=Window{abc u0 '+smoke.ui.PACKAGE+'/.MainActivity}'))
        for text in ['mCurrentFocus=null','mCurrentFocus=Window{abc u0 com.google.android.documentsui/.PickActivity}',
                     'mCurrentFocus=Window{abc u0 '+smoke.ui.PACKAGE+'.other/.MainActivity}']:
            self.assertFalse(smoke.has_app_focus(text))

    def test_modal_ack_cannot_be_inferred_from_a_background_or_other_app_frame(self):
        with self.assertRaises(AssertionError):smoke.validate_details_ack(self.frame())
        frame=self.frame()
        for text in ['Scan-Details','Verarbeitungsdetails schließen']:
            ET.SubElement(frame,'node',{'package':smoke.ui.PACKAGE,'text':text,'content-desc':text,'enabled':'true','bounds':'[30,100][450,172]'})
        smoke.validate_details_ack(frame)
        list(frame)[-1].set('package','other.app')
        with self.assertRaises(AssertionError):smoke.validate_details_ack(frame)
