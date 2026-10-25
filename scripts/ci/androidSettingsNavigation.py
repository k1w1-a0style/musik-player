"""Public settings navigation contracts, shared by the device harness and tests."""
ACCENTS = ('cover','green','cyan','turquoise','blue','violet','purple','pink','red','orange','yellow','neutral')

def settings_group_for(key):
    if key.startswith(('settings-appAccent-', 'settings-playerAccent-', 'settings-waveform-accent-',
                       'settings-color-', 'settings-appearance-', 'settings-skin-')) or key in ('settings-instant-colors','settings-theme-preview'):
        return 'appearance'
    if key.startswith(('settings-player-layout-', 'settings-resume')):
        return 'player'
    if key.startswith('settings-cover-bass-') or key == 'settings-quiet-profile':
        return 'motion'
    if key.startswith(('settings-density-', 'settings-library-update-', 'settings-tag-cleaner')):
        return 'library'
    if key.startswith(('backup-', 'settings-backup')):
        return 'data'
    return None

def color_target_for(key):
    for prefix,target in (('settings-appAccent-','appAccent'),('settings-playerAccent-','playerAccent'),('settings-waveform-accent-','waveform')):
        if key.startswith(prefix):
            return target
    return None

def settings_control_order(key):
    groups=('appearance','player','motion','library','data')
    for index,group in enumerate(groups):
        if key=='settings-group-'+group:
            return index,0
    exact={'settings-instant-colors':(0,30),'settings-theme-preview':(0,60),
           'settings-cover-bass-pulse':(2,1),'settings-cover-bass-pulse-option':(2,1),
           'settings-quiet-profile':(2,2),'settings-resume':(1,1),'settings-resume-enabled':(1,1),'settings-resume-clear':(1,2),
           'settings-backup':(4,1),'backup-create':(4,2),'backup-inspect':(4,3),'backup-select-restore':(4,4),'settings-tag-cleaner':(3,10),
           'settings-library-update-onOpen':(3,1),'settings-library-update-whileOpen':(3,2)}
    if key in exact:return exact[key]
    families=(('settings-appAccent-',0,10,ACCENTS),('settings-playerAccent-',0,10,ACCENTS),
              ('settings-waveform-accent-',0,10,ACCENTS),('settings-color-target-',0,1,('appAccent','playerAccent','waveform')),
              ('settings-appearance-',0,40,('dark','light')),('settings-skin-',0,50,('graphite','minimal','neon-cover')),
              ('settings-player-layout-',1,10,('classic','soundcloud')),('settings-density-',3,4,('standard','compact')))
    for prefix,group,offset,options in families:
        if key.startswith(prefix) and key[len(prefix):] in options:return group,offset+options.index(key[len(prefix):])
    return None
