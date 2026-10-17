"""Public settings navigation contracts, shared by the device harness and tests."""
ACCENTS = ('cover','green','cyan','turquoise','blue','violet','purple','pink','red','orange','yellow','neutral')

def settings_group_for(key):
    if key.startswith(('settings-appAccent-', 'settings-playerAccent-', 'settings-waveform-accent-',
                       'settings-color-', 'settings-appearance-', 'settings-skin-')) or key in ('settings-instant-colors','settings-theme-preview'):
        return 'appearance'
    if key.startswith(('settings-player-layout-', 'settings-resume')):
        return 'player'
    if key.startswith(('settings-cover-bass-', 'settings-density-')) or key == 'settings-quiet-profile':
        return 'motion'
    if key.startswith(('backup-', 'settings-backup', 'settings-tag-cleaner')):
        return 'library'
    return None

def color_target_for(key):
    for prefix,target in (('settings-appAccent-','appAccent'),('settings-playerAccent-','playerAccent'),('settings-waveform-accent-','waveform')):
        if key.startswith(prefix):
            return target
    return None

def settings_control_order(key):
    groups=('appearance','player','motion','library')
    for index,group in enumerate(groups):
        if key=='settings-group-'+group:
            return index,0
    exact={'settings-instant-colors':(0,30),'settings-theme-preview':(0,60),
           'settings-cover-bass-pulse':(2,1),'settings-cover-bass-pulse-option':(2,1),
           'settings-quiet-profile':(2,2),'settings-resume':(1,1),'settings-resume-enabled':(1,1),'settings-resume-clear':(1,2),
           'settings-backup':(3,2),'backup-create':(3,3),'backup-inspect':(3,4),'backup-select-restore':(3,5),'settings-tag-cleaner':(3,1)}
    if key in exact:return exact[key]
    families=(('settings-appAccent-',0,10,ACCENTS),('settings-playerAccent-',0,10,ACCENTS),
              ('settings-waveform-accent-',0,10,ACCENTS),('settings-color-target-',0,1,('appAccent','playerAccent','waveform')),
              ('settings-appearance-',0,40,('dark','light')),('settings-skin-',0,50,('graphite','minimal','neon-cover')),
              ('settings-player-layout-',1,10,('classic','soundcloud')),('settings-density-',2,3,('standard','compact')))
    for prefix,group,offset,options in families:
        if key.startswith(prefix) and key[len(prefix):] in options:return group,offset+options.index(key[len(prefix):])
    return None
