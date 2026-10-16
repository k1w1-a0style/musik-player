import copy
import unittest
import verifyApkContinuation as proof
import androidReleaseInteractionSmoke as smoke


class ContinuationProofTest(unittest.TestCase):
    def cases(self,expected):
        return [{'fontScale':c[0],'appearance':c[1],'skin':c[2],'density':c[3],
                 'menuBounds':[380,550,452,622],'playBounds':[28,529,290,656],
                 'sectionPlayback':{'title':smoke.TITLES[2],'nativeState':3}} for c in expected]

    def test_partition_covers_36_exactly_once(self):
        old=proof.historical_cases()
        single=smoke.song_info_cases('song-info-single')
        rest=smoke.song_info_cases('song-info-remaining')
        self.assertEqual((len(old),len(single),len(rest)),(25,1,10))
        self.assertEqual(len(old|single|rest),36)
        self.assertFalse(old&single or old&rest or single&rest)
        proof.validate_case_set(self.cases(old),old)

    def test_missing_duplicate_foreign_case_and_native_ack_are_rejected(self):
        expected=proof.historical_cases()
        good=self.cases(expected)
        for change in ('missing','duplicate','foreign','ack','small','overlap'):
            cases=copy.deepcopy(good)
            if change=='missing':cases.pop()
            if change=='duplicate':cases[-1]=cases[0]
            if change=='foreign':cases[0]['fontScale']='1.5'
            if change=='ack':cases[0]['sectionPlayback']['nativeState']=2
            if change=='small':cases[0]['menuBounds'][3]=621
            if change=='overlap':cases[0]['playBounds'][2]=390
            with self.subTest(change=change),self.assertRaises(AssertionError):
                proof.validate_case_set(cases,expected)


if __name__=='__main__':unittest.main()
