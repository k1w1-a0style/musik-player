import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
import zipfile
from verifyApkRetest import GATES, REPO, load_manifest, validate_manifest, validate_origin, verify_archive

class RetestManifestTest(unittest.TestCase):
    def setUp(self):
        self.data = dict(version=1, repository=REPO, sourceCommit='a'*40, runId=1, artifactId=2, artifactDigest='sha256:'+'b'*64, apkSha256=hashlib.sha256(b'apk').hexdigest())
        self.run = dict(id=1, head_sha='a'*40, head_branch='codex', event='push', status='completed', path='.github/workflows/ci.yml', repository={'full_name':REPO}, head_repository={'full_name':REPO})
        self.jobs = [dict(name=name, head_sha='a'*40, status='completed', conclusion='success') for name in GATES]
        self.artifact = dict(id=2, expired=False, name='musik-player-preview-'+'a'*40, workflow_run=dict(id=1,head_sha='a'*40), digest=self.data['artifactDigest'], size_in_bytes=100)
    def test_explicit_push_request_and_dispatch_use_same_manifest_validation(self):
        import json
        from unittest.mock import patch
        raw=json.dumps(self.data)
        with patch.dict('os.environ',{'GITHUB_EVENT_NAME':'push','APK_RETEST_MANIFEST':''}),patch('verifyApkRetest.Path.read_text',return_value=raw):
            self.assertEqual(load_manifest(),self.data)
        with patch.dict('os.environ',{'GITHUB_EVENT_NAME':'workflow_dispatch','APK_RETEST_MANIFEST':raw}):
            self.assertEqual(load_manifest(),self.data)
        with patch.dict('os.environ',{'GITHUB_EVENT_NAME':'workflow_dispatch','APK_RETEST_MANIFEST':''}):
            with self.assertRaises(AssertionError): load_manifest()
    def test_source_workflow_ignores_only_request_and_retest_trigger_is_codex_path_scoped(self):
        root=Path(__file__).resolve().parents[2]
        ci=(root/'.github/workflows/ci.yml').read_text()
        workflow=(root/'.github/workflows/android-manifest-retest.yml').read_text()
        self.assertIn('paths-ignore: ["docs/review/apk-retest-request.json"]',ci)
        self.assertIn("branches: [codex]\n    paths: ['docs/review/apk-retest-request.json']",workflow)
    def check(self):
        validate_origin(self.data, self.run, self.jobs, self.artifact, ['docs/review/status.md','scripts/ci/driver.py'])
    def test_explicit_valid_origin(self): self.check()
    def test_no_latest_or_missing_pin(self):
        for field in ('sourceCommit','artifactId','artifactDigest','apkSha256'):
            data=copy.deepcopy(self.data); del data[field]
            with self.assertRaises(AssertionError): validate_manifest(data)
    def test_wrong_or_expired_artifact(self):
        for field,value in [('expired',True),('id',3),('digest','sha256:'+'c'*64),('name','latest'),('size_in_bytes',0)]:
            with self.subTest(field=field):
                old=self.artifact[field];self.artifact[field]=value
                with self.assertRaises(AssertionError): self.check()
                self.artifact[field]=old
    def test_wrong_source_run_workflow_repository(self):
        for field,value in [('head_sha','c'*40),('id',5),('head_branch','main'),('status','in_progress'),('event','pull_request'),('path','.github/workflows/other.yml'),('head_repository',{'full_name':'foreign/repo'})]:
            with self.subTest(field=field):
                old=self.run[field]; self.run[field]=value
                with self.assertRaises(AssertionError): self.check()
                self.run[field]=old
    def test_failed_missing_duplicate_or_foreign_gates(self):
        for change in ('failed','missing','duplicate','foreign'):
            jobs=copy.deepcopy(self.jobs)
            if change=='failed': jobs[0]['conclusion']='failure'
            if change=='missing': jobs.pop()
            if change=='duplicate': jobs.append(jobs[0])
            if change=='foreign': jobs[0]['head_sha']='d'*40
            with self.assertRaises(AssertionError): validate_origin(self.data,self.run,jobs,self.artifact,[])
    def test_changed_product_cannot_reuse_old_apk(self):
        for path in ['components/Button.tsx','package-lock.json','app.json','modules/expo-system-audio/build.gradle','scripts/patches/patchRntpV5.cjs']:
            with self.assertRaises(AssertionError): validate_origin(self.data,self.run,self.jobs,self.artifact,[path])
    def bundle(self, root, **changes):
        archive=root/'input.zip'; members={'musik-player-preview.apk':b'apk','source-commit.txt':b'a'*40,'apk-sha256.txt':self.data['apkSha256'].encode()}
        members.update(changes)
        with zipfile.ZipFile(archive,'w') as bundle:
            for name,value in members.items(): bundle.writestr(name,value)
        self.data['artifactDigest']='sha256:'+hashlib.sha256(archive.read_bytes()).hexdigest()
        return archive
    def test_exact_archive_extracts_only_after_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); archive=self.bundle(root); verify_archive(self.data,archive,root/'output')
            self.assertEqual((root/'output/musik-player-preview.apk').read_bytes(),b'apk')
    def test_changed_archive_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); archive=self.bundle(root);archive.write_bytes(archive.read_bytes()+b'tamper')
            with self.assertRaises(AssertionError): verify_archive(self.data,archive,root/'output')
            self.assertFalse((root/'output').exists())
    def test_changed_apk_embedded_source_or_unsafe_member_rejected(self):
        for changes in [{'musik-player-preview.apk':b'altered'},{'source-commit.txt':b'c'*40},{'apk-sha256.txt':b'c'*64},{'../escape':b'evil'}]:
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp); archive=self.bundle(root,**changes)
                with self.assertRaises(AssertionError): verify_archive(self.data,archive,root/'output')
                self.assertFalse((root/'output').exists())

if __name__=='__main__': unittest.main()
