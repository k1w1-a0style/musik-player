import unittest
from androidSettingsNavigation import settings_group_for,color_target_for,settings_control_order
class SettingsNavigationTest(unittest.TestCase):
    def test_three_colors_share_the_appearance_group_but_keep_independent_targets(self):
        for field,target in [('appAccent','appAccent'),('playerAccent','playerAccent'),('waveform-accent','waveform')]:
            key='settings-'+field+'-neutral'
            self.assertEqual(settings_group_for(key),'appearance')
            self.assertEqual(color_target_for(key),target)
        self.assertIsNone(settings_group_for('tag-cleaner-apply'))
    def test_order_tracks_compact_group_contents(self):
        self.assertLess(settings_control_order('settings-skin-minimal'),settings_control_order('settings-quiet-profile'))
        self.assertEqual(settings_group_for('backup-create'),'library')
