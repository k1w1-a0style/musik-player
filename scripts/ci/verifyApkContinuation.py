#!/usr/bin/env python3
"""Independently join exact-APK evidence; never turn a failed run into a passed run."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import androidReleaseInteractionSmoke as smoke

SOURCE = 'ddcc7ec2fcb03f68720927c23b06996d59b24dd1'
APK_SHA = '2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a'
OLD_RUN = 38844390898
OLD_HARNESS = '6271b3000ade93e2fb627ea440aa01887aec4436'
OLD_ARTIFACT = 12024085233
OLD_DIGEST = 'sha256:b28a56411251edad2a4815a0c32ae24e54d036a7750cabb3537c44b72d9515f5'


def case_key(case):
    return tuple(case[k] for k in ('fontScale','appearance','skin','density'))


def historical_cases():
    return {(scale,a,s,d) for scale in ('1.0','1.3') for a in ('dark','light')
            for s in ('graphite','minimal','neon-cover') for d in ('standard','compact')} | {('2.0','dark','graphite','standard')}


def validate_case_set(cases, expected):
    actual = [case_key(c) for c in cases]
    assert len(actual) == len(expected) and set(actual) == expected, 'Missing, duplicate or unrelated matrix case'
    for c in cases:
        assert c['sectionPlayback'] == {'title':smoke.TITLES[2],'nativeState':3}, 'Missing actual section playback ACK'
        x1,y1,x2,y2 = c['menuBounds']
        assert x2-x1 >= 72 and y2-y1 >= 72, 'Menu touch area below 48dp'
        assert c['playBounds'][2] <= x1+1, 'Play action overlaps menu'


def png(path):
    data=path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24]) == (480,960), 'Missing/wrong native screenshot'


def verify_matrix(root, cases, expected):
    validate_case_set(cases, expected)
    for c in cases:
        stem='-'.join(case_key(c))
        for surface in ('settings','library','player'):
            png(root/(surface+'-'+stem+'.png'))
            ET.parse(root/(surface+'-'+stem+'.xml'))
        frame=ET.parse(root/('library-'+stem+'.xml')).getroot()
        controls=[n for n in frame.iter('node') if n.get('resource-id','').startswith('song-card-info-')
                  and smoke.rect(n)==c['menuBounds']]
        assert len(controls)==1 and controls[0].get('package')==smoke.PACKAGE and controls[0].get('enabled')=='true', 'Matrix info action has no unique enabled native witness'
        assert smoke.scroll_candidate(controls[0].get('resource-id'),frame) is not None, 'Matrix action is clipped'
        assert smoke.validate_library_header_touch_areas(frame)==c['header'], 'Header witness differs'
        assert smoke.validate_library_section_touch_areas(frame)==c['section'], 'Section witness differs'
        smoke.validate_playing_session((root/('section-playback-'+stem+'.txt')).read_text(),smoke.TITLES[2])


def verify_prefix(root):
    base=root/'release-interaction'
    log=(root/'release-ui.log').read_text()
    expected=('public scan, formats and collection','targeted responsive SoundCloud info action and real navigation',
              'resume and real process restart','native background playback and real queue gestures',
              'SAF backup export, inspection and restore','V5 independent accents and persistence',
              'V5 cleaner synthetic SAF transaction','font, theme and density matrix')
    assert tuple(re.findall(r'^Stage: (.+)$',log,re.M))==expected, 'Original functional prefix incomplete or reordered'
    assert log.count('Traceback (most recent call last):')==1 and log.rstrip().endswith('AssertionError: Scrollable UI not reachable: song-card-info-1000000019'), 'Original run has another failure'
    assert log.index('Stage: font, theme and density matrix') < log.index('Traceback (most recent call last):'), 'Failure before matrix'
    origin=json.loads((root/'retest-origin.json').read_text())
    assert origin['sourceCommit']==SOURCE and origin['apkSha256']==APK_SHA, 'Wrong original APK'
    assert json.loads((base/'diagnostic-errors.json').read_text())=={}, 'Incomplete original diagnostics'
    logs=(base/'logcat.txt').read_text()
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|ANR in '+re.escape(smoke.PACKAGE),logs), 'Original runtime failure'
    playback=[]
    for title in (*smoke.TITLES[:3],'V3 SAF'):
        matches=re.findall(r'^Native playback: '+re.escape(title)+r': (\d+)s -> (\d+)s, state=3$',log,re.M)
        assert matches and all(int(b)>=int(a)+2 for a,b in matches), 'Native format playback not demonstrated'
        playback.append({'title':title,'samples':matches,'nativeState':3})
    fonts=[]
    for scale in ('1.0','1.3','1.5','2.0'):
        frame=ET.parse(base/('soundcloud-info-font-'+scale+'.xml')).getroot()
        geometry=smoke.validate_soundcloud_info_chip(frame)
        hero=smoke.candidate('track-info-hero',ET.parse(base/('soundcloud-info-open-font-'+scale+'.xml')).getroot())
        assert hero is not None and hero.get('package')==smoke.PACKAGE, 'Actual TrackInfo route not demonstrated'
        for stem in ('soundcloud-info-font-','soundcloud-info-open-font-'):png(base/(stem+scale+'.png'))
        fonts.append({'fontScale':scale,**geometry,'trackInfoOpened':True})
    for mode,stem in (('display','v5-cleaner-confirmed-display-result'),('file','v5-cleaner-confirmed-saf-file-result')):
        smoke.validate_cleaner_result(ET.parse(base/(stem+'.xml')).getroot(),mode)
        png(base/(stem+'.png'))
    original=(base/'audio/V5-cleaner.mp3').read_bytes()
    written=(base/'audio/V5-after-preview.mp3').read_bytes()  # immutable harness pulls final write to this path
    cleaner=smoke.validate_cleaner_write(original,written)
    assert (base/'audio/V5-cleaner.lrc').read_bytes()==(base/'audio/V5-after-write.lrc').read_bytes(), 'Sidecar changed'
    assert abs(float(json.loads((base/'v5-cleaner-independent-ffprobe.json').read_text())['format']['duration'])-75)<.25
    assert len(json.loads((base/'exported-backup.json').read_text())['playlists'][0]['songIds'])==2
    return {'stagesCompletedBeforeMatrix':list(expected[:-1]),'nativePlayback':playback,'soundcloudInfoFonts':fonts,
            'cleaner':cleaner,'prefixLogSha256':hashlib.sha256(log.encode()).hexdigest(),
            'runtimeFailures':False,'limits':['Read-only/display byte equality, resume, queue, accents and restore assertions are witnessed by completion of the immutable original harness; no new device execution is claimed.']}


def verify_probe(root,mode):
    base=root/'release-interaction'
    data=json.loads((base/'stage-result.json').read_text())
    assert data['status']=='stage-only-passed' and data['releaseAccepted'] is False and data['mode']==mode, 'Probe is not a successful scoped stage'
    assert data['sourceCommit']==SOURCE and data['apkSha256']==APK_SHA, 'Probe APK differs'
    assert json.loads((base/'diagnostic-errors.json').read_text())=={}, 'Probe diagnostics failed'
    log=(base/'logcat.txt').read_text()
    assert not re.search(r'FATAL EXCEPTION|ErrorBoundary caught|ANR in '+re.escape(smoke.PACKAGE),log), 'Probe runtime failure'
    cases=data['v5Proofs']['matrix']
    verify_matrix(base,cases,smoke.song_info_cases(mode))
    return data


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('original',type=Path)
    parser.add_argument('--single',type=Path)
    parser.add_argument('--remaining',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    prefix=verify_prefix(args.original)
    old=json.loads((args.original/'release-interaction/matrix-progress.json').read_text())
    verify_matrix(args.original/'release-interaction',old,historical_cases())
    output={'sourceCommit':SOURCE,'apkSha256':APK_SHA,'status':'partial-verified','releaseAccepted':False,
            'historicalRunConclusion':'failure','historicalMatrixPassed':len(old),'prefix':prefix,'matrix':old}
    for mode,root in (('song-info-single',args.single),('song-info-remaining',args.remaining)):
        if root:
            proof=verify_probe(root,mode)
            output['matrix']+=proof['v5Proofs']['matrix']
            output[mode]={'harnessCommit':proof['harnessCommit'],'cases':len(proof['v5Proofs']['matrix'])}
    if args.single and args.remaining:
        smoke.validate_matrix_coverage(output['matrix'])
        assert len({case_key(c) for c in output['matrix']})==36
        output['status']='composite-device-evidence-verified'
        # Final review must additionally bind all archives to GitHub metadata,
        # verify APK/signature and complete the independent screenshot inspection.
    args.output.write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({'status':output['status'],'cases':len(output['matrix']),'releaseAccepted':False}))


if __name__=='__main__':main()
