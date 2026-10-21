import unittest
import os
from pathlib import Path
import subprocess
import tempfile
from verifyEmulatorLibraries import validate_output, inspect_libraries


class EmulatorLibrariesTest(unittest.TestCase):
    def test_resolved_ldd_report_passes(self):
        validate_output('linux-vdso.so.1 (0x00007fff)\nlibpulse.so.0 => /lib/x86_64-linux-gnu/libpulse.so.0 (0x0010)\n')

    def test_missing_library_rejects_without_external_search_tool(self):
        with self.assertRaisesRegex(AssertionError, 'Unresolved.*libpulse.so.0'):
            validate_output('linux-vdso.so.1 (0x00007fff)\nlibpulse.so.0 => not found\n')

    def test_empty_report_is_not_a_success(self):
        for text in ('', ' \n\t'):
            with self.assertRaisesRegex(AssertionError, 'Empty'):
                validate_output(text)

    def test_real_loader_resolves_bundled_sdk_libraries_but_rejects_missing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            core=root/'lib64';qt=core/'qt/lib';qt.mkdir(parents=True)
            binary=root/'qemu/linux-x86_64/qemu-system-x86_64'
            binary.parent.mkdir(parents=True)
            for target,name in ((core,'k1w1_core_probe'),(qt,'k1w1_qt_probe')):
                source=root/(name+'.c');source.write_text('int '+name+'(void) { return 1; }')
                subprocess.run(['cc','-shared','-fPIC',str(source),'-o',str(target/('lib'+name+'.so'))],check=True,capture_output=True)
            source=root/'main.c';source.write_text('int k1w1_core_probe(void); int k1w1_qt_probe(void); int main(void) { return k1w1_core_probe()+k1w1_qt_probe(); }')
            subprocess.run(['cc',str(source),'-L'+str(core),'-L'+str(qt),'-lk1w1_core_probe','-lk1w1_qt_probe','-o',str(binary)],check=True,capture_output=True)
            raw=subprocess.run(['ldd',str(binary)],env=dict(os.environ,LD_LIBRARY_PATH=''),text=True,capture_output=True,check=True)
            with self.assertRaisesRegex(AssertionError,'Unresolved'):
                validate_output(raw.stdout)
            report=root/'verified.txt'
            inspect_libraries(root,report)
            self.assertIn(str(core/'libk1w1_core_probe.so'),report.read_text())
            self.assertIn(str(qt/'libk1w1_qt_probe.so'),report.read_text())
            (qt/'libk1w1_qt_probe.so').unlink()
            with self.assertRaisesRegex(AssertionError,'Unresolved.*k1w1_qt_probe'):
                inspect_libraries(root,report)
