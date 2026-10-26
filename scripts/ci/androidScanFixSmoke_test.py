import unittest
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
