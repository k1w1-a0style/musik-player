import unittest
import xml.etree.ElementTree as ET
from androidScanFixSmoke import scan_receipt

class ScanReceiptTest(unittest.TestCase):
    def frame(self, terminal='Schnellscan – abgeschlossen', processed=12, total=12, errors=0):
        root=ET.Element('hierarchy')
        for text in (terminal,f'{processed} von {total} gefundenen Dateien verarbeitet',f'Neu: 12 · Geändert: 0 · Unverändert: 0 · Ungeprüft: 0 · Leseprobleme: {errors}'):
            ET.SubElement(root,'node',{'text':text,'package':'com.k1w1a0style.musikplayer'})
        return root
    def test_complete_requires_real_terminal_ack_and_all_twelve_files(self):
        self.assertIn('Neu: 12',scan_receipt(self.frame(),12))
        for root in (self.frame(processed=2), self.frame(terminal='Schnellscan – teilweise abgeschlossen'), self.frame(errors=2)):
            with self.assertRaises(AssertionError):scan_receipt(root,12)
    def test_unrelated_app_text_never_proves_scan_completion(self):
        root=self.frame()
        for node in root:node.set('package','other.app')
        with self.assertRaises(AssertionError):scan_receipt(root,12)
