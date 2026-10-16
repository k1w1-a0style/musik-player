#!/usr/bin/env python3
"""Fail-closed provenance for an explicitly selected future APK; no latest lookup."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request
import zipfile

REPO = 'k1w1-a0style/musik-player'
GATES = ('Dependency security audit', 'Typecheck, tests, coverage, lint, config gates', 'Android native build and tests')
FIELDS = {'version', 'repository', 'sourceCommit', 'runId', 'artifactId', 'artifactDigest', 'apkSha256'}


def validate_manifest(data):
    assert isinstance(data, dict) and set(data) == FIELDS, 'Unexpected/missing manifest fields'
    assert data['version'] == 1 and data['repository'] == REPO, 'Wrong manifest/repository'
    assert re.fullmatch(r'[0-9a-f]{40}', data['sourceCommit']), 'Source must be an immutable SHA'
    for name in ('runId', 'artifactId'):
        assert type(data[name]) is int and data[name] > 0, 'Invalid explicit ' + name
    assert re.fullmatch(r'sha256:[0-9a-f]{64}', data['artifactDigest']), 'Missing archive digest'
    assert re.fullmatch(r'[0-9a-f]{64}', data['apkSha256']), 'Missing APK digest'


def load_manifest():
    raw = os.environ.get('APK_RETEST_MANIFEST', '')
    if not raw:
        assert os.environ.get('GITHUB_EVENT_NAME') == 'push', 'Missing dispatch manifest'
        raw = Path('docs/review/apk-retest-request.json').read_text()
    assert len(raw) <= 8192, 'Retest manifest too large'
    data = json.loads(raw)
    validate_manifest(data)
    return data


def load_execution_mode():
    path = Path('docs/review/apk-retest-execution.json')
    if not path.exists():
        return ''
    data = json.loads(path.read_text())
    assert data == {'version': 1, 'mode': 'song-info-single'}, 'Unsupported explicit retest execution scope'
    return data['mode']


def validate_origin(data, run, jobs, artifact, changed):
    validate_manifest(data)
    source = data['sourceCommit']
    assert run['id'] == data['runId'] and run['head_sha'] == source, 'Wrong source run'
    assert run['head_branch'] == 'codex' and run['event'] == 'push' and run['status'] == 'completed', 'Untrusted/incomplete source run'
    assert run['path'] == '.github/workflows/ci.yml', 'Wrong source workflow'
    assert run['repository']['full_name'] == REPO and run['head_repository']['full_name'] == REPO, 'Foreign source repository'
    for name in GATES:
        selected = [job for job in jobs if job.get('name') == name]
        assert len(selected) == 1, 'Missing/ambiguous source gate: ' + name
        job = selected[0]
        assert job.get('head_sha') == source and job.get('status') == 'completed' and job.get('conclusion') == 'success', 'Failed/mismatched source gate: ' + name
    assert artifact['id'] == data['artifactId'] and artifact['expired'] is False, 'Wrong/expired artifact'
    assert artifact['name'] == 'musik-player-preview-' + source, 'Wrong artifact name'
    assert artifact['workflow_run']['id'] == run['id'] and artifact['workflow_run']['head_sha'] == source, 'Artifact belongs to another run/source'
    assert artifact['digest'] == data['artifactDigest'], 'Artifact archive digest mismatch'
    assert 0 < artifact['size_in_bytes'] <= 500 * 1024 * 1024, 'Artifact size out of bounds'
    assert all(path.startswith(('docs/', 'scripts/ci/', '.github/workflows/')) for path in changed), 'App/build sources changed: rebuild required'


def verify_archive(data, archive, output):
    validate_manifest(data)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == data['artifactDigest'][7:], 'Downloaded archive digest mismatch'
    allowed = {'musik-player-preview.apk', 'source-commit.txt', 'apk-sha256.txt', 'preview-apk-inspection.log', 'preview-apk-signature.log'}
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        assert len(names) == len(set(names)) and set(names) <= allowed, 'Unexpected/duplicate ZIP members'
        assert {'musik-player-preview.apk', 'source-commit.txt', 'apk-sha256.txt'} <= set(names), 'Missing APK/source proof'
        assert sum(item.file_size for item in bundle.infolist()) <= 500 * 1024 * 1024, 'Expanded archive too large'
        assert bundle.testzip() is None, 'Corrupt archive'
        assert bundle.read('source-commit.txt').decode().strip() == data['sourceCommit'], 'Wrong embedded source'
        assert bundle.read('apk-sha256.txt').decode().split()[0] == data['apkSha256'], 'Wrong embedded APK hash'
        assert hashlib.sha256(bundle.read('musik-player-preview.apk')).hexdigest() == data['apkSha256'], 'Altered APK bytes'
        output.mkdir(parents=True, exist_ok=False)
        bundle.extractall(output)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def api(path):
    request = urllib.request.Request('https://api.github.com/repos/' + REPO + '/' + path,
        headers={'Authorization': 'Bearer ' + os.environ['GH_READ_TOKEN'], 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def download_artifact(artifact_id, target):
    request = urllib.request.Request(f'https://api.github.com/repos/{REPO}/actions/artifacts/{artifact_id}/zip',
        headers={'Authorization': 'Bearer ' + os.environ['GH_READ_TOKEN']})
    try:
        urllib.request.build_opener(NoRedirect()).open(request, timeout=30)
        raise AssertionError('Expected GitHub signed archive redirect')
    except urllib.error.HTTPError as error:
        assert error.code == 302, 'Artifact API refused download'
        location = error.headers['Location']
    assert location.startswith('https://'), 'Unsafe archive redirect'
    # The short-lived signed URL receives NO GitHub bearer token.
    with urllib.request.urlopen(location, timeout=120) as response, target.open('wb') as output:
        size = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            assert size <= 500 * 1024 * 1024, 'Archive download too large'
            output.write(chunk)


def main():
    data = load_manifest()
    mode = load_execution_mode()
    run = api(f"actions/runs/{data['runId']}")
    jobs = api(f"actions/runs/{data['runId']}/jobs?per_page=100")
    assert jobs['total_count'] <= 100, 'Incomplete source gate pagination'
    artifact = api(f"actions/artifacts/{data['artifactId']}")
    changed = subprocess.check_output(['git', 'diff', '--name-only', data['sourceCommit'], os.environ['GITHUB_SHA']], text=True).splitlines()
    validate_origin(data, run, jobs['jobs'], artifact, changed)
    archive = Path('inspected-apk.zip')
    download_artifact(data['artifactId'], archive)
    assert archive.stat().st_size == artifact['size_in_bytes'], 'Archive length mismatch'
    verify_archive(data, archive, Path('preview-input'))
    Path('ci-logs').mkdir(exist_ok=True)
    Path('ci-logs/retest-origin.json').write_text(json.dumps(data, indent=2) + '\n')
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as output:
        output.write('APK_DIAGNOSTIC_MODE=' + mode + '\n')
        output.write('REVIEWED_APK_SOURCE_COMMIT=' + data['sourceCommit'] + '\nEXPECTED_APK_SHA256=' + data['apkSha256'] + '\n')
    print('Explicit source gates, source equality, archive and exact APK verified; no rebuild performed.')


if __name__ == '__main__':
    main()
